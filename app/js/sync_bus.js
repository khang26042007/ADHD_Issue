/* ============================================================
   MODULE: TRI-LAYER HYBRID STATE BUS (MiloSyncBus)
   ============================================================ */
    /* ============================================================
       0.1 TRI-LAYER HYBRID STATE BUS (MiloSyncBus)
       ============================================================ */
    class MiloSyncBus {
      constructor(options = {}) {
        this.roomId = options.roomId || this._getUrlParam('room') || 'family_room_milo_01';
        this.role = options.role || this._getUrlParam('role') || 'dual'; // 'dual', 'child', 'parent'
        const savedKid = (typeof localStorage !== 'undefined' && (localStorage.getItem('milo_child_device_kid_id') || localStorage.getItem('milo_active_kid_id'))) || 'kid_leo_01';
        this.kidId = options.kidId || this._getUrlParam('kid_id') || savedKid;
        this.clientId = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

        this.channelName = 'milo_quest_sync';
        this.storageEventKey = 'milo_quest_sync_event';
        this.storageStateKey = 'milo_quest_saved_state';
        this.storageStateBackupKey = 'milo_sync_state_v1';

        this.subscribers = new Map();
        this.channel = null;
        this.ws = null;
        this.isWsConnected = false;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.pingTimer = null;
        this.processedEventIds = new Set();

        // 1. Initialize Layer 2: BroadcastChannel
        this._initBroadcastChannel();

        // 2. Initialize Layer 2 fallback: LocalStorage storage event
        this._initStorageListener();

        // 3. Initialize Layer 3: WebSocket with silent degradation
        this._initWebSocket();
      }

      _getUrlParam(param) {
        if (typeof window === 'undefined' || !window.location) return null;
        try {
          const urlParams = new URLSearchParams(window.location.search);
          return urlParams.get(param);
        } catch (e) {
          return null;
        }
      }

      /* ---------------- Layer 1: In-Memory Loopback ---------------- */
      subscribe(eventType, callback) {
        if (!this.subscribers.has(eventType)) {
          this.subscribers.set(eventType, []);
        }
        this.subscribers.get(eventType).push(callback);
        return () => {
          const list = this.subscribers.get(eventType) || [];
          this.subscribers.set(eventType, list.filter(cb => cb !== callback));
        };
      }

      on(eventType, callback) {
        return this.subscribe(eventType, callback);
      }

      _dispatchLocal(eventType, payload, envelope) {
        const callbacks = this.subscribers.get(eventType) || [];
        callbacks.forEach(cb => {
          try {
            cb(payload, envelope);
          } catch (err) {
            console.error(`[MiloSyncBus] Error in subscriber for ${eventType}:`, err);
          }
        });
      }

      /* ---------------- Layer 2: BroadcastChannel & LocalStorage ---------------- */
      _initBroadcastChannel() {
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            this.channel = new BroadcastChannel(this.channelName);
            this.channel.onmessage = (event) => {
              const envelope = event.data;
              if (!envelope || !envelope.event_type) return;
              if (envelope.sender_id === this.clientId) return; // Anti-echo
              if (envelope.event_id && this.processedEventIds.has(envelope.event_id)) return; // Anti-duplicate
              if (envelope.event_id) {
                this.processedEventIds.add(envelope.event_id);
                if (this.processedEventIds.size > 200) {
                  const first = this.processedEventIds.values().next().value;
                  this.processedEventIds.delete(first);
                }
              }
              this._dispatchLocal(envelope.event_type, envelope.payload, envelope);
            };
          }
        } catch (e) {
          console.warn('[MiloSyncBus] BroadcastChannel unavailable, using LocalStorage fallback.', e);
        }
      }

      _initStorageListener() {
        if (typeof window === 'undefined') return;
        window.addEventListener('storage', (e) => {
          if (e.key === this.storageEventKey && e.newValue) {
            try {
              const envelope = JSON.parse(e.newValue);
              if (!envelope || !envelope.event_type) return;
              if (envelope.sender_id === this.clientId) return; // Anti-echo
              if (envelope.event_id && this.processedEventIds.has(envelope.event_id)) return; // Anti-duplicate
              if (envelope.event_id) {
                this.processedEventIds.add(envelope.event_id);
                if (this.processedEventIds.size > 200) {
                  const first = this.processedEventIds.values().next().value;
                  this.processedEventIds.delete(first);
                }
              }
              this._dispatchLocal(envelope.event_type, envelope.payload, envelope);
            } catch (err) {}
          }
        });
      }

      /* ---------------- Layer 3: WebSocket Auto-Connect & Silent Degradation ---------------- */
      _initWebSocket() {
        const isHttps = typeof window !== 'undefined' && window.location && window.location.protocol === 'https:';
        const host = (typeof window !== 'undefined' && window.location && window.location.hostname) || 'localhost';
        const explicitWsPort = this._getUrlParam('ws_port');
        let portPart = '';
        if (explicitWsPort) {
          portPart = `:${explicitWsPort}`;
        } else if (typeof window !== 'undefined' && window.location && window.location.port) {
          portPart = `:${window.location.port}`;
        } else if (!isHttps) {
          portPart = ':8000';
        }
        const wsProto = isHttps ? 'wss://' : 'ws://';
        const wsRole = this.role === 'child' ? 'kid' : (this.role === 'parent' ? 'parent' : 'kid');
        const effectiveKidId = (typeof appState !== 'undefined' && appState.childDeviceKidId && wsRole === 'kid')
          ? appState.childDeviceKidId
          : (this.kidId || 'kid_leo_01');
        const wsUrl = `${wsProto}${host}${portPart}/ws/sync?room_id=${encodeURIComponent(this.roomId)}&role=${encodeURIComponent(wsRole)}&client_id=${encodeURIComponent(this.clientId)}&kid_id=${encodeURIComponent(effectiveKidId)}`;

        try {
          this.ws = new WebSocket(wsUrl);

          this.ws.onopen = () => {
            this.isWsConnected = true;
            this.reconnectAttempts = 0;
            this._updateSyncIndicator(true);
            this._startHeartbeat();
          };

          this.ws.onmessage = (e) => {
            try {
              const data = JSON.parse(e.data);
              this._handleIncomingWsMessage(data);
            } catch (err) {}
          };

          this.ws.onclose = () => {
            this.isWsConnected = false;
            this._stopHeartbeat();
            this._updateSyncIndicator(false);
            this._scheduleReconnect();
          };

          this.ws.onerror = () => {
            if (this.ws) {
              try { this.ws.close(); } catch (err) {}
            }
          };
        } catch (e) {
          this.isWsConnected = false;
          this._updateSyncIndicator(false);
          this._scheduleReconnect();
        }
      }

      _startHeartbeat() {
        this._stopHeartbeat();
        this.pingTimer = setInterval(() => {
          if (this.ws && this.isWsConnected && this.ws.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ event_type: "PING", client_id: this.clientId }));
            } catch (err) {}
          }
        }, 25000);
      }

      _stopHeartbeat() {
        if (this.pingTimer) {
          clearInterval(this.pingTimer);
          this.pingTimer = null;
        }
      }

      reconnectWithKid(newKidId) {
        if (!newKidId) return;
        this.kidId = newKidId;
        if (this.ws) {
          try {
            this.ws.onclose = null;
            this.ws.close();
          } catch (_) {}
        }
        this._initWebSocket();
      }

      _scheduleReconnect() {
        if (this.reconnectTimer) return;
        const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000);
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this._initWebSocket();
        }, backoff);
      }

      _handleIncomingWsMessage(data) {
        if (data.event_type === "CONNECTION_ESTABLISHED" || data.event_type === "ROOM_STATE_HYDRATE") {
          if (data.state && typeof applyServerRoomState === 'function') {
            applyServerRoomState(data.state);
          }
          return;
        }

        if (data.event_type === "PONG") {
          return;
        }


        if (data.sender && data.sender === this.clientId) return;

        // Handle Children List Update
        if (data.event_type === "CHILDREN_LIST_UPDATED") {
          if (typeof fetchChildrenList === 'function') {
            fetchChildrenList();
          }
          return;
        }

        // Handle Dispatch Route with strict kid_id isolation
        if (data.event_type === "NEW_DISPATCH_ROUTE") {
          const targetKid = data.kid_id || (data.data && data.data.kid_id);
          
          // Phía Mẹ: Cập nhật lộ trình Mẹ xem NẾU Mẹ đang xem đúng bé này
          if (typeof appState !== 'undefined' && targetKid === appState.parentSelectedKidId) {
            const roadmapData = (Array.isArray(data.roadmap) && data.roadmap.length > 0)
              ? data.roadmap
              : (data.data && Array.isArray(data.data.stations) ? data.data.stations : []);
            if (roadmapData.length > 0) {
              appState.parentChildRoadmap = roadmapData;
              appState.parentCurrentRoadmapIndex = 0;
            }
            if (typeof renderParentActiveRoadmapList === 'function') {
              renderParentActiveRoadmapList();
            }
          }

          // Phía Con: CHỈ KHI NÀO điện thoại máy con này đang đăng nhập đúng bé targetKid
          // Nếu máy con đang là bé khác -> Chạy ngầm trong SQLite, KHÔNG ĐƯỢC làm nhảy đảo máy con!
          const isForChildDevice = (typeof appState !== 'undefined' && targetKid === appState.childDeviceKidId);
          if (isForChildDevice) {
            if (Array.isArray(data.roadmap) && data.roadmap.length > 0) {
              appState.childRoadmap = data.roadmap;
            } else if (data.data && Array.isArray(data.data.stations)) {
              appState.childRoadmap = data.data.stations;
            }
            appState.currentRoadmapIndex = 0;
            appState.currentStepIndex = 0;
            appState.activeTask = (appState.childRoadmap && appState.childRoadmap[0]) || null;
            if (appState.selectedClues && typeof appState.selectedClues.clear === 'function') appState.selectedClues.clear();
            if (appState.cleanedItems && typeof appState.cleanedItems.clear === 'function') appState.cleanedItems.clear();
            
            if (typeof renderChildIslandRoadmap === 'function') renderChildIslandRoadmap();
            if (data.alert_message && typeof showToast === 'function') {
              showToast("Bản Đồ Mới", data.alert_message, "🗺️");
            }
          }
          return;
        }

        // Server translated event: Kid step done -> Parent notification (with cross-child toast)
        if (data.event_type === "PARENT_NOTIFICATION_STEP_DONE") {
          const evKidId = data.kid_id;
          if (evKidId && typeof appState !== 'undefined' && appState.activeChildId && evKidId !== appState.activeChildId) {
            const otherKid = (appState.childrenList || []).find(c => c.kid_id === evKidId);
            const otherName = otherKid ? otherKid.name : "Con";
            if (typeof showToast === 'function') {
              showToast(`🎉 ${otherName} vừa hoàn thành bước!`, data.message || `+${data.points_earned || 25} ⭐`, "🦁");
            }
            return;
          }
          this._dispatchLocal("STEP_COMPLETED", {
            stepIndex: data.step_id ? data.step_id - 1 : 0,
            starsEarned: data.points_earned || 40,
            message: data.message
          }, data);
          return;
        }

        // Server translated event: Parent cheer -> Kid receive cheer
        if (data.event_type === "KID_RECEIVE_CHEER") {
          const cheerMsg = data.cheer_text || data.message || "Bố mẹ rất tự hào về sự kiên trì của con!";
          this._dispatchLocal("PARENT_CHEER_SEND", {
            cheerText: cheerMsg,
            message: cheerMsg,
            sticker: data.sticker || "milo_thumbs_up"
          }, data);
          return;
        }

        // Standard broadcasted event
        const eventType = data.event_type;
        const payload = data.payload || data;
        this._dispatchLocal(eventType, payload, data);
      }

      _updateSyncIndicator(wsActive) {
        const indicator = document.getElementById('sync-status-indicator');
        if (!indicator) return;
        if (wsActive) {
          indicator.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span class="text-emerald-300">WebSocket Online</span>';
        } else {
          indicator.innerHTML = '<span class="w-2 h-2 rounded-full bg-teal-400"></span><span class="text-teal-300">WebBus Local (&lt;2ms)</span>';
        }
      }

      /* ---------------- Unified Broadcast Dispatch ---------------- */
      broadcast(eventType, payload = {}) {
        const senderKidId = (typeof appState !== 'undefined' && (this.role === 'child' ? appState.childDeviceKidId : appState.parentSelectedKidId)) || this.kidId || 'kid_leo_01';
        const targetKidId = (payload && (payload.target_kid_id || payload.kid_id)) || senderKidId;
        const envelope = {
          event_type: eventType,
          event_id: 'evt_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
          sender_id: this.clientId,
          sender_role: this.role,
          room_id: this.roomId,
          kid_id: targetKidId,
          target_kid_id: targetKidId,
          sender_kid_id: senderKidId,
          timestamp: Date.now(),
          payload: payload
        };

        // Mark as processed locally
        this.processedEventIds.add(envelope.event_id);
        if (this.processedEventIds.size > 200) {
          const first = this.processedEventIds.values().next().value;
          this.processedEventIds.delete(first);
        }

        // 1. Layer 1: In-Memory Loopback (0ms instant execution)
        this._dispatchLocal(eventType, payload, envelope);

        // 2. Layer 2: BroadcastChannel
        if (this.channel) {
          try {
            this.channel.postMessage(envelope);
          } catch (err) {
            console.warn('[MiloSyncBus] BroadcastChannel post failed:', err);
          }
        }

        // 3. Layer 2 Fallback: LocalStorage event trigger
        try {
          localStorage.setItem(this.storageEventKey, JSON.stringify(envelope));
        } catch (err) {}

        // 4. Layer 3: WebSocket Server Broadcast
        if (this.ws && this.isWsConnected && this.ws.readyState === WebSocket.OPEN) {
          try {
            if (eventType === "STEP_COMPLETED" && (this.role === 'child' || this.role === 'kid')) {
              this.ws.send(JSON.stringify({
                event_type: "KID_STEP_COMPLETED",
                step_id: (payload.stepIndex !== undefined ? payload.stepIndex + 1 : 1),
                dopamine_points: payload.starsEarned || 40,
                kid_id: senderKidId,
                target_kid_id: senderKidId,
                payload: payload
              }));
            } else if (eventType === "PARENT_CHEER_SEND" && this.role === 'parent') {
              const cheerMsg = (typeof payload === 'string' ? payload : (payload && (payload.cheerText || payload.message))) || "Mẹ rất tự hào về con!";
              this.ws.send(JSON.stringify({
                event_type: "PARENT_CHEER",
                cheer_text: cheerMsg,
                message: cheerMsg,
                sticker: (payload && payload.sticker) || "milo_thumbs_up",
                kid_id: targetKidId,
                target_kid_id: targetKidId,
                payload: payload
              }));
            } else {
              this.ws.send(JSON.stringify(envelope));
            }
          } catch (err) {
            console.warn('[MiloSyncBus] WebSocket send failed:', err);
          }
        }
      }

      emit(eventType, payload) {
        this.broadcast(eventType, payload);
      }

      /* ---------------- State Persistence API ---------------- */
      savePersistedState(stateSnapshot) {
        try {
          const kidKey = (stateSnapshot && (stateSnapshot.childDeviceKidId || stateSnapshot.activeChildId)) || this.kidId || 'kid_leo_01';
          const serialized = JSON.stringify({
            version: 1,
            kid_id: kidKey,
            last_updated: Date.now(),
            stars: stateSnapshot.stars,
            childRoadmap: stateSnapshot.childRoadmap,
            currentRoadmapIndex: stateSnapshot.currentRoadmapIndex,
            currentStepIndex: stateSnapshot.currentStepIndex,
            activeTaskId: stateSnapshot.activeTask ? stateSnapshot.activeTask.id : null,
            pendingTicket: stateSnapshot.pendingTicket || null,
            pauseCount: stateSnapshot.pauseCount || 0,
            totalSessionSeconds: stateSnapshot.totalSessionSeconds || 0,
            selectedCatalogIds: Array.from(stateSnapshot.selectedCatalogIds || []),
            childRoutineRoadmap: stateSnapshot.childRoutineRoadmap || [],
            selectedRoutineIds: stateSnapshot.selectedRoutineIds ? Array.from(stateSnapshot.selectedRoutineIds) : [],
            completedRoutineIds: stateSnapshot.completedRoutineIds ? Array.from(stateSnapshot.completedRoutineIds) : [],
            routinePhotoProofs: stateSnapshot.routinePhotoProofs || {},
            simulatedTimeSlot: stateSnapshot.simulatedTimeSlot || 'morning',
            roadmapCleared: !!stateSnapshot.roadmapCleared,
            routineCleared: !!stateSnapshot.routineCleared
          });
          localStorage.setItem(`${this.storageStateKey}_${kidKey}`, serialized);
          localStorage.setItem(this.storageStateKey, serialized);
          localStorage.setItem(this.storageStateBackupKey, serialized);
        } catch (err) {}
      }

      loadPersistedState(targetKidId) {
        try {
          const kidKey = targetKidId || (typeof appState !== 'undefined' && appState.childDeviceKidId) || this.kidId || 'kid_leo_01';
          const data = localStorage.getItem(`${this.storageStateKey}_${kidKey}`) || localStorage.getItem(this.storageStateKey) || localStorage.getItem(this.storageStateBackupKey);
          if (!data) return null;
          const parsed = JSON.parse(data);
          if (parsed && parsed.kid_id && parsed.kid_id !== kidKey) {
            return null;
          }
          return parsed;
        } catch (err) {
          return null;
        }
      }

      clearPersistedState() {
        try {
          localStorage.removeItem(this.storageStateKey);
          localStorage.removeItem(this.storageStateBackupKey);
        } catch (err) {}
      }
    }

    /* ============================================================
       0.15 SERVER-AUTHORITATIVE STATE HYDRATION (WEBSOCKET DRIVEN)
       ============================================================ */
    function applyServerRoomState(state) {
      if (!state || typeof state !== 'object') return;
      if (typeof appState === 'undefined') return;

      const stateKidId = state.kid_id;

      // Update background cache
      if (stateKidId && appState.childrenStates) {
        appState.childrenStates[stateKidId] = {
          ...(appState.childrenStates[stateKidId] || {}),
          ...state
        };
      }

      // 1. Phía Máy Con: CHỈ áp dụng nếu state này của đúng bé đang đăng nhập trên máy con
      const isForActiveChild = !stateKidId || (stateKidId === appState.childDeviceKidId);
      if (isForActiveChild) {
        if (state.stars !== undefined && typeof updateStarsEverywhere === 'function') {
          appState.stars = state.stars;
          updateStarsEverywhere(state.stars);
        }

        if (Array.isArray(state.child_roadmap)) {
          if (state.child_roadmap.length === 0 || state.roadmap_cleared) {
            appState.childRoadmap = [];
            appState.activeTask = null;
            appState.currentRoadmapIndex = 0;
            appState.roadmapCleared = true;
            try { if (typeof localStorage !== 'undefined') localStorage.setItem('milo_roadmap_cleared', 'true'); } catch(_) {}
          } else {
            const validTasks = state.child_roadmap.filter(t => (
              t && typeof t === 'object' && t.id && Array.isArray(t.steps) && t.steps.length > 0
            ));
            if (validTasks.length > 0) {
              appState.childRoadmap = validTasks;
              appState.roadmapCleared = false;
              try { if (typeof localStorage !== 'undefined') localStorage.removeItem('milo_roadmap_cleared'); } catch(_) {}
            }
          }
        }

        if (Array.isArray(state.child_routine_roadmap)) {
          if (state.child_routine_roadmap.length === 0 || state.routine_cleared) {
            appState.childRoutineRoadmap = [];
            appState.routineCleared = true;
            try { if (typeof localStorage !== 'undefined') localStorage.setItem('milo_routine_cleared', 'true'); } catch(_) {}
          } else {
            appState.childRoutineRoadmap = state.child_routine_roadmap;
            appState.routineCleared = false;
            try { if (typeof localStorage !== 'undefined') localStorage.removeItem('milo_routine_cleared'); } catch(_) {}
          }
          if (typeof renderChildRoutineRoadmapFromTasks === 'function') {
            renderChildRoutineRoadmapFromTasks(appState.childRoutineRoadmap);
          }
        }

        if (state.current_roadmap_index !== undefined && state.current_roadmap_index >= 0) {
          const maxIdx = Math.max(0, (appState.childRoadmap || []).length - 1);
          appState.currentRoadmapIndex = Math.min(state.current_roadmap_index, maxIdx);
        }

        if (appState.childRoadmap && appState.childRoadmap.length > 0) {
          appState.activeTask = appState.childRoadmap[appState.currentRoadmapIndex] || appState.childRoadmap[0];
        }

        if (state.current_step_index !== undefined && state.current_step_index >= 0) {
          appState.currentStepIndex = state.current_step_index;
        }

        if (state.pending_ticket) {
          appState.pendingTicket = state.pending_ticket;
          const banner = document.getElementById('parent-golden-ticket-banner');
          const redDot = document.getElementById('p-reward-dot');
          const desc = document.getElementById('parent-ticket-desc');
          if (banner) banner.classList.remove('hidden');
          if (redDot) redDot.classList.remove('hidden');
          const kidName = (appState.childrenList || []).find(c => c.kid_id === stateKidId)?.name || "Bé";
          if (desc) desc.innerText = `🎉 ${kidName} vừa dùng ${state.pending_ticket.cost || 500} ⭐ để đổi [Vé Vàng: ${state.pending_ticket.title}]!`;
        } else {
          appState.pendingTicket = null;
          const banner = document.getElementById('parent-golden-ticket-banner');
          const redDot = document.getElementById('p-reward-dot');
          if (banner) banner.classList.add('hidden');
          if (redDot) redDot.classList.add('hidden');
        }

        if (typeof renderChildIslandRoadmap === 'function') {
          renderChildIslandRoadmap();
        }
      }

      // 2. Phía Mẹ: CHỈ áp dụng nếu state này của đúng bé mẹ đang chọn xem
      const isForParentActive = !stateKidId || (stateKidId === appState.parentSelectedKidId);
      if (isForParentActive) {
        if (Array.isArray(state.child_roadmap)) {
          appState.parentChildRoadmap = state.child_roadmap;
          appState.parentCurrentRoadmapIndex = state.current_roadmap_index || 0;
          if (typeof renderParentActiveRoadmapList === 'function') {
            renderParentActiveRoadmapList();
          }
        }
        if (Array.isArray(state.child_routine_roadmap)) {
          appState.parentChildRoutineRoadmap = state.child_routine_roadmap;
          if (typeof renderParentRoutineAudit === 'function') {
            renderParentRoutineAudit();
          }
        }
      }
    }
    if (typeof window !== 'undefined') { window.applyServerRoomState = applyServerRoomState; }

    /* ============================================================
       0.2 MODAL CONTROLLER & SUBSCRIBERS REGISTRATION
       ============================================================ */

    function showChildTicketApprovedModal(ticketTitle, praiseMessage) {
      const modal = document.getElementById('child-modal-ticket-approved');
      if (!modal) return;
      const nameEl = document.getElementById('child-approved-ticket-name');
      if (nameEl) nameEl.innerText = ticketTitle || "Vé Vàng Của Bé";
      const praiseEl = document.getElementById('child-approved-ticket-praise');
      if (praiseEl && praiseMessage) {
        praiseEl.innerText = `"${praiseMessage}"`;
      }
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      playSfx('success');
      spawnStars();
    }

    function closeChildTicketApprovedModal() {
      playSfx('tap');
      const modal = document.getElementById('child-modal-ticket-approved');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }
    }

    function registerMiloSyncSubscribers(bus) {
      // 0. ROADMAP_UPDATED: Parent deletes/clears islands -> Child updates immediately if matches kid
      bus.subscribe('ROADMAP_UPDATED', (payload, envelope) => {
        if (!payload) return;
        const targetKid = payload.target_kid_id || payload.kid_id || (envelope && (envelope.target_kid_id || envelope.kid_id));
        const newRoadmap = Array.isArray(payload.roadmap) ? payload.roadmap : [];
        const currentIdx = (typeof payload.currentIdx === 'number') ? payload.currentIdx : 0;

        // Background cache update
        if (targetKid && typeof appState !== 'undefined') {
          if (!appState.childrenStates) appState.childrenStates = {};
          if (!appState.childrenStates[targetKid]) appState.childrenStates[targetKid] = {};
          appState.childrenStates[targetKid].child_roadmap = newRoadmap;
          appState.childrenStates[targetKid].current_roadmap_index = currentIdx;
        }

        // Parent View update
        if (typeof appState !== 'undefined' && (!targetKid || targetKid === appState.parentSelectedKidId)) {
          appState.parentChildRoadmap = newRoadmap;
          appState.parentCurrentRoadmapIndex = currentIdx;
          if (typeof renderParentActiveRoadmapList === 'function') {
            renderParentActiveRoadmapList();
          }
        }

        // Child View update: ONLY IF this child device is logged into targetKid
        const isForThisChild = typeof appState !== 'undefined' && (!targetKid || targetKid === appState.childDeviceKidId);
        if (isForThisChild) {
          appState.childRoadmap = newRoadmap;
          appState.currentRoadmapIndex = currentIdx;
          appState.activeTask = appState.childRoadmap[appState.currentRoadmapIndex] || null;
          appState.currentStepIndex = 0;
          appState.roadmapCleared = (newRoadmap.length === 0);
          if (appState.roadmapCleared) {
            try { if (typeof localStorage !== 'undefined') localStorage.setItem('milo_roadmap_cleared', 'true'); } catch(_) {}
          } else {
            try { if (typeof localStorage !== 'undefined') localStorage.removeItem('milo_roadmap_cleared'); } catch(_) {}
          }
          if (typeof renderChildIslandRoadmap === 'function') {
            renderChildIslandRoadmap();
          }
          bus.savePersistedState(appState);
        }
      });

      // 1. TASK_ASSIGN_BATCH: Parent dispatches -> Child renders Island Roadmap
      bus.subscribe('TASK_ASSIGN_BATCH', (payload, envelope) => {
        if (!payload || !payload.tasks || !Array.isArray(payload.tasks) || payload.tasks.length === 0) return;
        const validBatch = payload.tasks.filter(t => (
          t &&
          typeof t === 'object' &&
          t.id &&
          Array.isArray(t.steps) &&
          t.steps.length > 0
        ));
        if (validBatch.length === 0) return;

        const targetKid = payload.target_kid_id || payload.kid_id || (envelope && (envelope.target_kid_id || envelope.kid_id));

        // Background cache update
        if (targetKid && typeof appState !== 'undefined') {
          if (!appState.childrenStates) appState.childrenStates = {};
          if (!appState.childrenStates[targetKid]) appState.childrenStates[targetKid] = {};
          appState.childrenStates[targetKid].child_roadmap = validBatch;
          appState.childrenStates[targetKid].current_roadmap_index = 0;
          appState.childrenStates[targetKid].current_step_index = 0;
        }

        // Parent View update
        if (typeof appState !== 'undefined' && (!targetKid || targetKid === appState.parentSelectedKidId)) {
          appState.parentChildRoadmap = validBatch;
          appState.parentCurrentRoadmapIndex = 0;
          if (typeof renderParentActiveRoadmapList === 'function') {
            renderParentActiveRoadmapList();
          }
        }

        // Child View update: ONLY IF this child device is logged into targetKid
        const isForThisChild = typeof appState !== 'undefined' && (!targetKid || targetKid === appState.childDeviceKidId);
        if (isForThisChild) {
          appState.childRoadmap = validBatch;
          appState.currentRoadmapIndex = 0;
          appState.activeTask = validBatch[0];
          appState.currentStepIndex = 0;
          appState.roadmapCleared = false;
          try { if (typeof localStorage !== 'undefined') localStorage.removeItem('milo_roadmap_cleared'); } catch(_) {}

          if (typeof renderChildIslandRoadmap === 'function') {
            renderChildIslandRoadmap();
          }
          if (typeof childSwitchScreen === 'function') {
            childSwitchScreen('home');
          }
          bus.savePersistedState(appState);
          if (typeof showToast === 'function') {
            showToast("Hải Trình Mới Sẵn Sàng!", `Mẹ vừa giao ${validBatch.length} đảo thử thách!`, "🏝️");
          }
        }
      });

      // 2. STEP_TELEMETRY_UPDATE: Child updates step -> Parent telemetry bar updates
      bus.subscribe('STEP_TELEMETRY_UPDATE', (payload, envelope) => {
        const sourceKid = (envelope && (envelope.sender_kid_id || envelope.kid_id)) || (payload && payload.kid_id);
        if (typeof appState !== 'undefined' && appState.role === 'child' && sourceKid && sourceKid !== appState.childDeviceKidId) {
          return;
        }
        if (typeof appState !== 'undefined' && (appState.role === 'parent' || appState.role === 'dual')) {
          if (sourceKid && appState.parentSelectedKidId && sourceKid !== appState.parentSelectedKidId) {
            return;
          }
        }
        const total = payload.totalSteps || (appState.activeTask ? appState.activeTask.steps.length : 3);
        const activeNum = (payload.stepIndex !== undefined ? payload.stepIndex + 1 : 1);
        renderParentTelemetryProgress(total, activeNum);
        if (payload.elapsedSec !== undefined) {
          const durEl = document.getElementById('telemetry-duration');
          if (durEl) durEl.innerHTML = `${formatTime(payload.elapsedSec)} <span class="font-normal text-slate-400 text-[10px]">(Thời gian thực)</span>`;
        }
        if (typeof updateParentCoachInsights === 'function' && appState.activeTask) {
          updateParentCoachInsights(appState.activeTask, activeNum - 1, payload);
        }
      });

      // 3. STEP_COMPLETED: Child finishes micro-step -> Parent progress updates
      bus.subscribe('STEP_COMPLETED', (payload, envelope) => {
        const sourceKid = (envelope && (envelope.sender_kid_id || envelope.kid_id)) || (payload && payload.kid_id);
        
        // On Child Device: Ignore other kids' completions
        if (typeof appState !== 'undefined' && appState.role === 'child' && sourceKid && sourceKid !== appState.childDeviceKidId) {
          return;
        }

        // On Parent Device:
        if (typeof appState !== 'undefined' && (appState.role === 'parent' || appState.role === 'dual')) {
          if (sourceKid && appState.parentSelectedKidId && sourceKid !== appState.parentSelectedKidId) {
            const otherKid = (appState.childrenList || []).find(c => c.kid_id === sourceKid);
            const otherName = otherKid ? otherKid.name : "Con";
            if (typeof showToast === 'function') {
              showToast(`⭐ ${otherName} hoàn thành bước!`, `+${payload.starsEarned || 40} ⭐`, "🦁");
            }
            return;
          }
        }

        if (payload.totalStarsNow !== undefined) {
          updateStarsEverywhere(payload.totalStarsNow);
        }
        const total = payload.totalSteps || 3;
        const nextStep = (payload.stepIndex !== undefined ? payload.stepIndex + 1 : 1);
        renderParentTelemetryProgress(total, nextStep);

        const badge = document.getElementById('telemetry-status-badge');
        if (badge) {
          badge.innerHTML = `⭐ Bước ${payload.stepIndex + 1} hoàn thành!`;
          badge.className = "inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold";
        }
        if (appState.role === "parent" || appState.role === "dual") {
          const kidName = (appState.parentSelectedKidProfile && appState.parentSelectedKidProfile.name) || "Leo";
          showToast("Tiến Độ Cập Nhật", `${kidName} vừa hoàn thành bước ${payload.stepIndex + 1}! (+${payload.starsEarned || 40} ⭐)`, "⭐");
        }
      });

      // 4. ISLAND_COMPLETED: Whole island cleared
      bus.subscribe('ISLAND_COMPLETED', (payload, envelope) => {
        const sourceKid = (envelope && (envelope.sender_kid_id || envelope.kid_id)) || (payload && payload.kid_id);
        if (typeof appState !== 'undefined' && appState.role === 'child' && sourceKid && sourceKid !== appState.childDeviceKidId) {
          return;
        }
        const kidName = (sourceKid && (appState.childrenList || []).find(c => c.kid_id === sourceKid)?.name) || "Leo";
        showToast("Đảo Đã Chinh Phục!", `${kidName} đã hoàn thành đảo: ${payload.islandTitle || 'Thành công'}!`, "🎉");
        const badge = document.getElementById('telemetry-status-badge');
        if (badge) {
          badge.innerHTML = "🎉 Vừa hoàn thành đảo!";
          badge.className = "inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold";
        }
      });

      // 5. TREASURE_UNLOCKED: All islands completed
      bus.subscribe('TREASURE_UNLOCKED', (payload, envelope) => {
        const sourceKid = (envelope && (envelope.sender_kid_id || envelope.kid_id)) || (payload && payload.kid_id);
        if (typeof appState !== 'undefined' && appState.role === 'child' && sourceKid && sourceKid !== appState.childDeviceKidId) {
          return;
        }
        showToast("Rương Báu Hoàng Kim!", "Tất cả các đảo đã hoàn thành. Rương báu đã mở!", "👑");
      });

      // 6. TICKET_REDEEM_REQUEST: Child redeems ticket -> Parent banner alerts
      bus.subscribe('TICKET_REDEEM_REQUEST', (payload, envelope) => {
        const sourceKid = (envelope && (envelope.sender_kid_id || envelope.kid_id)) || (payload && payload.kid_id);
        if (typeof appState !== 'undefined' && appState.role === 'child' && sourceKid && sourceKid !== appState.childDeviceKidId) {
          return;
        }
        appState.pendingTicket = payload;
        bus.savePersistedState(appState);

        const banner = document.getElementById('parent-golden-ticket-banner');
        const doneBanner = document.getElementById('parent-golden-ticket-done');
        const redDot = document.getElementById('p-reward-dot');
        const desc = document.getElementById('parent-ticket-desc');

        const kidName = (sourceKid && (appState.childrenList || []).find(c => c.kid_id === sourceKid)?.name) || "Bé";
        if (banner) banner.classList.remove('hidden');
        if (doneBanner) doneBanner.classList.add('hidden');
        if (redDot) redDot.classList.remove('hidden');
        if (desc) desc.innerText = `🎉 ${kidName} vừa dùng ${payload.cost} ⭐ để đổi [Vé Vàng: ${payload.title}]!`;

        playSfx('bell');
        showToast("Yêu Cầu Vé Vàng", `${kidName} muốn đổi: ${payload.title} (${payload.cost} ⭐)`, "🎟️");
      });

      // 7. TICKET_APPROVAL_RESPONSE: Parent approves -> Child celebration modal fires!
      bus.subscribe('TICKET_APPROVAL_RESPONSE', (payload, envelope) => {
        const targetKid = payload.target_kid_id || payload.kid_id || (envelope && (envelope.target_kid_id || envelope.kid_id));
        if (targetKid && typeof appState !== 'undefined' && targetKid !== appState.childDeviceKidId) {
          return;
        }
        if (payload.approved) {
          showChildTicketApprovedModal(payload.title, payload.praiseMessage);
          appState.pendingTicket = null;
          bus.savePersistedState(appState);
        }
      });

      // 8. MILO_RESCUE_TRIGGER: Child activates CBT breathing -> Parent coach updates
      bus.subscribe('MILO_RESCUE_TRIGGER', (payload, envelope) => {
        const sourceKid = (envelope && (envelope.sender_kid_id || envelope.kid_id)) || (payload && payload.kid_id);
        if (typeof appState !== 'undefined' && appState.role === 'child' && sourceKid && sourceKid !== appState.childDeviceKidId) {
          return;
        }
        appState.pauseCount = payload.pauseCount || (appState.pauseCount + 1);
        const pCountEl = document.getElementById('telemetry-pause-count');
        if (pCountEl) {
          pCountEl.innerHTML = `${appState.pauseCount} lần <span class="text-emerald-600 font-semibold">(Biết tự điều tiết CBT)</span>`;
        }
        const badge = document.getElementById('telemetry-status-badge');
        if (badge) {
          badge.innerHTML = "🔋 Tự giác Pause (CBT)";
        }
        const kidName = (sourceKid && (appState.childrenList || []).find(c => c.kid_id === sourceKid)?.name) || "Bé";
        showToast("Milo Hỗ Trợ Cảm Xúc", `${kidName} đang thực hiện bài tập thở bụng 4-4-4 cùng Milo.`, "🌿");
      });

      // 9. PARENT_CHEER_SEND: Parent sends cheer -> Milo animation & bubble on Child screen
      bus.subscribe('PARENT_CHEER_SEND', (payload, envelope) => {
        const targetKid = (payload && (payload.target_kid_id || payload.kid_id)) || (envelope && (envelope.target_kid_id || envelope.kid_id));
        if (targetKid && typeof appState !== 'undefined' && targetKid !== appState.childDeviceKidId) {
          return;
        }
        playSfx('bell');
        const cheerMsg = (typeof payload === 'string' ? payload : (payload && (payload.cheerText || payload.message))) || "Mẹ rất tự hào về con!";
        const speechEl = document.getElementById('child-milo-speech');
        if (speechEl) {
          speechEl.innerText = `👩 Mẹ nhắn: "${cheerMsg}" ❤️`;
          if (speechEl.parentElement) {
            speechEl.parentElement.classList.add('scale-105', 'ring-2', 'ring-amber-300');
            setTimeout(() => {
              if (speechEl.parentElement) speechEl.parentElement.classList.remove('scale-105', 'ring-2', 'ring-amber-300');
            }, 4000);
          }
        }
        showToast("Lời Khen Của Mẹ", cheerMsg, "❤️");
      });

      // 10. STARS_SYNC: Bidirectional star balance synchronizer
      bus.subscribe('STARS_SYNC', (payload, envelope) => {
        if (!payload || payload.totalStars === undefined) return;
        const targetKid = payload.target_kid_id || payload.kid_id || (envelope && (envelope.target_kid_id || envelope.kid_id));

        if (targetKid && typeof appState !== 'undefined') {
          if (!appState.childrenStates) appState.childrenStates = {};
          if (!appState.childrenStates[targetKid]) appState.childrenStates[targetKid] = {};
          appState.childrenStates[targetKid].stars = payload.totalStars;
          if (appState.childrenData && appState.childrenData[targetKid]) {
            appState.childrenData[targetKid].stars = payload.totalStars;
          }
        }

        const isForThisChild = typeof appState !== 'undefined' && (!targetKid || targetKid === appState.childDeviceKidId);
        if (isForThisChild) {
          if (payload.totalStars !== appState.stars) {
            appState.stars = payload.totalStars;
            if (typeof updateStarsEverywhere === 'function') {
              updateStarsEverywhere(payload.totalStars);
            } else {
              document.querySelectorAll('.sync-star-val').forEach(el => el.innerText = payload.totalStars);
            }
            bus.savePersistedState(appState);
          }
        }

        if (typeof appState !== 'undefined' && (!targetKid || targetKid === appState.parentSelectedKidId)) {
          if (appState.parentSelectedKidProfile) {
            appState.parentSelectedKidProfile.stars = payload.totalStars;
          }
          if (typeof renderParentProfileCards === 'function') {
            renderParentProfileCards();
          }
        }
      });

      // 11. ROUTINE_PHOTO_SUBMITTED: Child completes photo proof -> Parent notification & gallery update
      bus.subscribe('ROUTINE_PHOTO_SUBMITTED', (payload, envelope) => {
        if (!payload) return;
        const sourceKid = (envelope && (envelope.sender_kid_id || envelope.kid_id)) || (payload && payload.kid_id);
        if (typeof appState !== 'undefined' && appState.role === 'child' && sourceKid && sourceKid !== appState.childDeviceKidId) {
          return;
        }

        if (payload.routine_id) {
          if (!appState.completedRoutineIds) appState.completedRoutineIds = new Set();
          appState.completedRoutineIds.add(payload.routine_id);
          if (!appState.routinePhotoProofs) appState.routinePhotoProofs = {};
          appState.routinePhotoProofs[payload.routine_id] = payload;
        }

        const kidName = (sourceKid && (appState.childrenList || []).find(c => c.kid_id === sourceKid)?.name) || "Leo";
        if (typeof showToast === 'function') {
          showToast("Minh Chứng Thói Quen", `${kidName} vừa hoàn thành [${payload.routine_title || 'Dọn dẹp'}] và lưu ảnh vào Nhật ký!`, "📷");
        }
        const dot = document.getElementById('p-routine-nav-dot');
        if (dot) dot.classList.remove('hidden');

        if (typeof renderParentRoutineAudit === 'function') {
          renderParentRoutineAudit();
        }
        if (typeof renderChildRoutineRoadmapFromTasks === 'function') {
          renderChildRoutineRoadmapFromTasks(appState.childRoutineRoadmap);
        }
        if (typeof bus.savePersistedState === 'function') {
          bus.savePersistedState(appState);
        }
      });

      // 12. ROUTINE_HEART_RECEIVED: Parent sends heart -> Child celebration
      bus.subscribe('ROUTINE_HEART_RECEIVED', (payload, envelope) => {
        const targetKid = payload.target_kid_id || payload.kid_id || (envelope && (envelope.target_kid_id || envelope.kid_id));
        if (targetKid && typeof appState !== 'undefined' && targetKid !== appState.childDeviceKidId) {
          return;
        }
        if (typeof triggerRoutineHeartCelebration === 'function') {
          triggerRoutineHeartCelebration(payload.praise_message || "Mẹ rất thích sự tự giác của con! Thưởng thêm +5⭐!");
        }
      });

      // 13. ROUTINE_ASSIGN_BATCH: Parent assigns routines -> Child routine island updates
      bus.subscribe('ROUTINE_ASSIGN_BATCH', (payload, envelope) => {
        if (!payload || !Array.isArray(payload.routines)) return;
        const targetKid = payload.target_kid_id || payload.kid_id || (envelope && (envelope.target_kid_id || envelope.kid_id));

        // Background cache update
        if (targetKid && typeof appState !== 'undefined') {
          if (!appState.childrenStates) appState.childrenStates = {};
          if (!appState.childrenStates[targetKid]) appState.childrenStates[targetKid] = {};
          appState.childrenStates[targetKid].child_routine_roadmap = payload.routines;
        }

        // Parent View update
        if (typeof appState !== 'undefined' && (!targetKid || targetKid === appState.parentSelectedKidId)) {
          appState.parentChildRoutineRoadmap = payload.routines;
          appState.selectedRoutineIds = new Set(payload.routines.map(r => r.id).filter(Boolean));
          if (typeof renderParentRoutineAudit === 'function') renderParentRoutineAudit();
          if (typeof renderParentRoutinesCatalog === 'function') renderParentRoutinesCatalog();
        }

        // Child View update: ONLY IF this child device is logged into targetKid
        const isForThisChild = typeof appState !== 'undefined' && (!targetKid || targetKid === appState.childDeviceKidId);
        if (isForThisChild) {
          appState.childRoutineRoadmap = payload.routines;
          appState.routineCleared = (payload.routines.length === 0);
          if (payload.routines.length > 0) {
            try { if (typeof localStorage !== 'undefined') localStorage.removeItem('milo_routine_cleared'); } catch(_) {}
          }

          if (payload.resetCompletions) {
            if (!appState.completedRoutineIds) appState.completedRoutineIds = new Set();
            if (!appState.routinePhotoProofs) appState.routinePhotoProofs = {};
            payload.routines.forEach(rt => {
              const id = typeof rt === 'string' ? rt : (rt ? rt.id : null);
              if (id) {
                appState.completedRoutineIds.delete(id);
                delete appState.routinePhotoProofs[id];
              }
            });
            appState.selectedActiveRoutineId = null;
            appState.currentRoutineIndex = 0;
          }

          if (typeof window.renderChildRoutineRoadmapFromTasks === 'function') {
            window.renderChildRoutineRoadmapFromTasks(payload.routines);
          }

          if (typeof bus.savePersistedState === 'function') {
            bus.savePersistedState(appState);
          }

      // 13. COGNITIVE_PROFILE_UPDATED: Adaptive real-time cognitive profile synchronization
      bus.subscribe('COGNITIVE_PROFILE_UPDATED', (payload, envelope) => {
        if (!payload) return;
        const newProfile = payload.cognitive_profile || payload;
        const targetKid = payload.target_kid_id || payload.kid_id || (envelope && (envelope.target_kid_id || envelope.kid_id));

        if (typeof appState !== 'undefined') {
          if (!targetKid || targetKid === appState.activeChildId || targetKid === appState.childDeviceKidId) {
            appState.cognitiveProfile = newProfile;
            try {
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('milo_cognitive_profile', JSON.stringify(newProfile));
              }
            } catch(e) {}
            if (typeof updateCognitiveProfileUI === 'function') {
              updateCognitiveProfileUI(newProfile);
            }
          }
        }

        const tierInfo = payload.tier_info || (newProfile && newProfile.scaffolding_tier_info) || {};
        const tierName = tierInfo.tier_name || newProfile.scaffolding_tier || 'Bậc thích ứng';
        if (typeof showToast === 'function') {
          showToast("Hồ Sơ Nhận Thức Thích Ứng", `Bé vừa cập nhật: ${tierName}!`, "🎯");
        }
      });

          if (typeof showToast === 'function') {
            if (payload.routines.length > 0) {
              showToast("Nề Nếp Mới!", `Mẹ vừa cập nhật ${payload.routines.length} thói quen mới trên Đảo Thói Quen!`, "🌟");
            } else {
              showToast("Đã Làm Mới", "Mẹ vừa làm mới toàn bộ thói quen trên Đảo Thói Quen!", "✨");
            }
          }
          const alertBadge = document.getElementById('badge-routine-alert');
          if (alertBadge) {
            if (payload.routines.length > 0) alertBadge.classList.remove('hidden');
            else alertBadge.classList.add('hidden');
          }
        }
      });
    }

