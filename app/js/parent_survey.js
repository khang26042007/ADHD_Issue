/* ============================================================
   MODULE: PARENT DASHBOARD & DIAGNOSTIC SURVEY ENGINE
   ============================================================ */
    function updateParentCoachInsights(task, stepIdx, telemetry) {
      const summaryEl = document.getElementById('ai-summary-text');
      const praiseEl = document.getElementById('parent-praise-script');
      if (!task) return;

      const title = task.title || "bài tập";
      const cat = task.cat || "math";
      const stepNum = (stepIdx !== undefined ? stepIdx + 1 : 1);
      const isPaused = telemetry && telemetry.isPaused;

      let insight = "";
      let praise = "";

      if (isPaused) {
        insight = `Leo vừa kích hoạt nhịp nghỉ vi mô Soft Pause 4-4-4 khi đang ở [${title}]. Não bộ bé đang tự điều hòa cảm xúc rất tốt thay vì nổi cơn bực bội hay bỏ cuộc.`;
        praise = `"Mẹ rất tự hào khi thấy Leo biết dừng lại thở sâu 4-4-4 khi mệt! Đó là bản lĩnh tự chủ của một nhà vô địch đấy con!"`;
      } else if (cat === 'math') {
        if (stepNum === 1) {
          insight = `Leo đang đọc đề và lọc dữ kiện bài toán [${title}]. Việc phân loại số liệu và từ khóa hỏi giúp vỏ não trước trán giải phóng 40% dung lượng bộ nhớ làm việc.`;
          praise = `"Mẹ khen ngợi cách Leo tìm đúng dữ kiện quan trọng của đề bài! Con đang tư duy mạch lạc và rất tập trung!"`;
        } else {
          insight = `Leo đang đặt tính từng chữ số ở Bước ${stepNum}. Thao tác tính toán từ phải sang trái giúp não bé neo chắc các hàng đơn vị, chục, trăm mà không bị lộn ngược kết quả.`;
          praise = `"Mẹ thấy Leo đặt tính rất thẳng hàng và cẩn thận! Mỗi phép tính đúng là một bước tiến tuyệt vời của con!"`;
        }
      } else if (cat === 'eng') {
        insight = `Leo đang rèn luyện khả năng đọc hiểu Tiếng Anh ở [${title}]. Việc xác định từ khóa câu hỏi trước khi đọc đoạn văn giúp loại bỏ 70% nhiễu thị giác cho trẻ ADHD.`;
        praise = `"Mẹ rất thích cách Leo nắm bắt câu hỏi Tiếng Anh thật chuẩn xác! Con đang trở thành một thợ săn từ khóa cừ khôi đấy!"`;
      } else if (cat === 'viet') {
        insight = `Leo đang cảm thụ biện pháp nghệ thuật trong [${title}]. Tách bạch chủ ngữ và từ ngữ nhân hóa/so sánh giúp bé củng cố khả năng liên tưởng ngôn ngữ sâu sắc.`;
        praise = `"Mẹ ấn tượng với cách Leo cảm nhận câu văn rất tinh tế! Cố lên nhé nhà thám hiểm ngôn ngữ nhí!"`;
      } else {
        insight = `Leo đang thực hiện chuỗi vi nhiệm vụ [${title}]. Việc chia nhỏ hành vi giúp giảm năng lượng kích hoạt ban đầu và dập tắt sức ỳ tâm lý hiệu quả nhất.`;
        praise = `"Mẹ nhìn thấy sự tự lập của Leo lớn lên từng ngày! Cảm ơn con đã cùng mẹ giữ gìn không gian tinh tươm!"`;
      }

      if (summaryEl) summaryEl.innerText = insight;
      if (praiseEl) praiseEl.innerText = praise;
    }


    /* ============================================================
       K. PHÍA PHỤ HUYNH: 2 HƯỚNG GIAO BÀI (KHO GDPT & TỰ GIAO)
       ============================================================ */
    function parentSwitchAssignMode(mode) {
      playSfx('tap');
      const btnCat = document.getElementById('p-mode-btn-catalog');
      const btnRt = document.getElementById('p-mode-btn-routines');
      const btnCus = document.getElementById('p-mode-btn-custom');
      const viewCat = document.getElementById('p-view-catalog');
      const viewRt = document.getElementById('p-view-routines');
      const viewCus = document.getElementById('p-view-custom');

      const allBtns = [btnCat, btnRt, btnCus];
      allBtns.forEach(b => {
        if (b) b.className = "py-2 rounded-xl text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-1 cursor-pointer";
      });

      if (viewCat) viewCat.classList.add('hidden');
      if (viewRt) viewRt.classList.add('hidden');
      if (viewCus) viewCus.classList.add('hidden');

      if (mode === 'catalog') {
        if (btnCat) btnCat.className = "py-2 rounded-xl bg-white text-teal-800 shadow-xs transition flex items-center justify-center gap-1 cursor-pointer font-black";
        if (viewCat) viewCat.classList.remove('hidden');
      } else if (mode === 'routines') {
        if (btnRt) btnRt.className = "py-2 rounded-xl bg-white text-amber-900 shadow-xs transition flex items-center justify-center gap-1 cursor-pointer font-black";
        if (viewRt) viewRt.classList.remove('hidden');
        renderParentRoutinesCatalog();
      } else {
        if (btnCus) btnCus.className = "py-2 rounded-xl bg-white text-indigo-800 shadow-xs transition flex items-center justify-center gap-1 cursor-pointer font-black";
        if (viewCus) viewCus.classList.remove('hidden');
      }

      appState.assignMode = mode;
      if (typeof renderParentActiveRoadmapList === 'function') {
        renderParentActiveRoadmapList();
      }
    }

    // ============================================================
    // QUẢN LÝ KHO THÓI QUEN SINH HOẠT & GIAO NỀ NẾP (ROUTINES)
    // ============================================================
    function renderParentRoutinesCatalog() {
      const container = document.getElementById('parent-routines-catalog-list');
      if (!container) return;
      container.innerHTML = '';

      if (!appState.selectedRoutineIds) {
        appState.selectedRoutineIds = new Set(['routine_morning_bed', 'routine_afterschool_drop', 'routine_clean_desk', 'routine_night_teeth']);
      }
      const filter = appState.routineFilter || 'all';
      const routines = window.routineDatabase || {};

      const items = Object.values(routines);
      items.forEach(rt => {
        if (!rt || !rt.id) return;
        if (filter !== 'all' && rt.timeline_slot !== filter) return;

        const isChecked = appState.selectedRoutineIds.has(rt.id);
        const card = document.createElement('div');
        card.className = `p-3 rounded-2xl border transition ${
          isChecked ? 'bg-amber-50/80 border-amber-300 shadow-2xs' : 'bg-white border-slate-200 hover:border-slate-300'
        }`;

        let slotBg = "bg-amber-100 text-amber-900";
        let slotName = "🌅 Sáng";
        if (rt.timeline_slot === 'afternoon') { slotBg = "bg-orange-100 text-orange-900"; slotName = "🌇 Chiều"; }
        else if (rt.timeline_slot === 'evening') { slotBg = "bg-sky-100 text-sky-900"; slotName = "🌙 Tối"; }
        else if (rt.timeline_slot === 'night') { slotBg = "bg-indigo-100 text-indigo-900"; slotName = "✨ Ngủ"; }

        const isMeal = (rt.flex_meal_config || rt.id.includes('dinner') || rt.id.includes('breakfast'));
        let dishesSummary = '';
        if (isMeal && rt.flex_meal_config && Array.isArray(rt.flex_meal_config.dishes)) {
          dishesSummary = rt.flex_meal_config.dishes.map(d => `${d.name} (${d.minutes}p - ${d.device_name || d.device})`).join(' • ');
        } else if (isMeal) {
          dishesSummary = 'Thịt kho (2p - Lò vi sóng) • Canh rau (2p - Bếp đun)';
        }

        card.innerHTML = `
          <div class="flex items-start gap-2.5">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleRoutineItem('${rt.id}', this.checked)" class="mt-1 w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer accent-amber-500 shrink-0">
            
            <div class="flex-1 min-w-0">
              <!-- Header Row: Slot badge, Stars, Expand Arrow -->
              <div class="flex items-center justify-between gap-1 mb-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="${slotBg} text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1">
                    <span>${slotName}</span>
                    <span>•</span>
                    <span id="label-time-${rt.id}">${rt.slot_time || '07:00'}</span>
                  </span>
                  <span class="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">+${rt.reward} ⭐</span>
                </div>

                <!-- Nút mũi tên mở thanh tùy chỉnh gọn gàng -->
                <button type="button" onclick="toggleRoutineDrawer('${rt.id}', event)" class="p-1 rounded-lg text-slate-400 hover:text-amber-800 hover:bg-amber-100 transition flex items-center gap-0.5 text-xs font-bold cursor-pointer" title="Mở bảng tùy chỉnh">
                  <span class="text-[10px] text-slate-500">Tùy chỉnh</span>
                  <span id="chevron-${rt.id}" class="transition-transform duration-200 inline-block font-mono">▾</span>
                </button>
              </div>

              <h4 class="font-extrabold text-xs text-slate-900 leading-snug flex items-center gap-1">
                <span>${rt.icon || '🌟'}</span>
                <span>${rt.title}</span>
              </h4>
              <p class="text-[10px] text-slate-500 mt-0.5 leading-tight">
                ${rt.steps ? rt.steps.length : 3} vi bước atomic • 📸 Chụp ảnh minh chứng
              </p>

              <!-- THANH RÚT GỌN TÙY CHỈNH (ACCORDION DRAWER) -->
              <div id="drawer-${rt.id}" class="hidden mt-2 pt-2 border-t border-amber-200/80 flex flex-col gap-2 bg-amber-50/60 -mx-1 px-2.5 py-2 rounded-xl text-left">
                <!-- 1. Tùy chỉnh giờ nhắc nhở -->
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                    <span>⏱️</span> <span>Giờ nhắc con:</span>
                  </span>
                  <input type="time" value="${rt.slot_time || '07:00'}"
                    onchange="parentUpdateRoutineSlotTime('${rt.id}', this.value)"
                    class="text-xs font-black font-mono bg-white border border-amber-300 rounded-lg px-2 py-1 text-slate-800 shadow-2xs focus:ring-2 focus:ring-amber-400 focus:outline-none cursor-pointer" />
                </div>

                <!-- 2. Nếu là món ăn (meal) -->
                ${isMeal ? `
                  <div class="pt-1.5 border-t border-amber-200/50 flex flex-col gap-1.5">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <span>🍳</span> <span>Thực đơn hâm nóng:</span>
                      </span>
                      <button type="button" onclick="parentOpenFlexMealConfig('${rt.id}')" class="text-[10px] font-black text-amber-950 bg-amber-300 hover:bg-amber-400 px-2 py-0.5 rounded-lg border border-amber-500 cursor-pointer shadow-2xs transition">
                        ✏️ Soạn lại món
                      </button>
                    </div>
                    <div class="text-[10px] text-slate-600 bg-white/90 p-2 rounded-lg border border-amber-200 leading-relaxed font-medium">
                      ${dishesSummary}
                    </div>
                  </div>
                ` : ''}
              </div>

            </div>
          </div>
        `;
        container.appendChild(card);
      });

      updateRoutineSelectedMeta();
    }

    function parentFilterRoutines(slot) {
      playSfx('tap');
      appState.routineFilter = slot;
      ['all', 'morning', 'afternoon', 'evening', 'night'].forEach(s => {
        const btn = document.getElementById(`p-rt-${s}`);
        if (!btn) return;
        if (s === slot) {
          btn.className = "px-2.5 py-1 rounded-xl bg-amber-500 text-amber-950 font-black shrink-0 shadow-2xs";
        } else {
          btn.className = "px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0";
        }
      });
      renderParentRoutinesCatalog();
    }

    function toggleRoutineItem(id, isChecked) {
      if (!appState.selectedRoutineIds) {
        appState.selectedRoutineIds = new Set();
      }
      if (isChecked) {
        appState.selectedRoutineIds.add(id);
      } else {
        appState.selectedRoutineIds.delete(id);
      }
      updateRoutineSelectedMeta();
      renderParentRoutinesCatalog();
    }

    function selectAllRoutines(selectAll) {
      playSfx('tap');
      if (!appState.selectedRoutineIds) {
        appState.selectedRoutineIds = new Set();
      }
      const routines = window.routineDatabase || {};
      if (selectAll) {
        Object.keys(routines).forEach(id => appState.selectedRoutineIds.add(id));
      } else {
        appState.selectedRoutineIds.clear();
      }
      updateRoutineSelectedMeta();
      renderParentRoutinesCatalog();
    }

    function updateRoutineSelectedMeta() {
      const countEl = document.getElementById('routine-selected-count');
      const metaEl = document.getElementById('routine-selected-meta');
      if (!countEl || !metaEl) return;

      const count = appState.selectedRoutineIds ? appState.selectedRoutineIds.size : 0;
      countEl.innerText = count;

      let totalStars = 0;
      const routines = window.routineDatabase || {};
      if (appState.selectedRoutineIds) {
        appState.selectedRoutineIds.forEach(id => {
          if (routines[id]) totalStars += (routines[id].reward || 20);
        });
      }

      metaEl.innerText = `${count} thói quen • +${totalStars} ⭐ tổng thưởng`;
    }

    async function dispatchSelectedRoutines() {
      playSfx('bell');
      appState.routineCleared = false;
      try { if (typeof localStorage !== 'undefined') localStorage.removeItem('milo_routine_cleared'); } catch(_) {}
      if (!appState.selectedRoutineIds || appState.selectedRoutineIds.size === 0) {
        alert("Vui lòng tick chọn ít nhất 1 thói quen để giao cho con!");
        return;
      }

      const routines = window.routineDatabase || {};
      const selected = Array.from(appState.selectedRoutineIds)
        .map(id => routines[id])
        .filter(Boolean);

      selected.sort((a, b) => (a.slot_time || '00:00').localeCompare(b.slot_time || '00:00'));

      const kidId = appState.parentSelectedKidId || 'kid_leo_01';
      const currentKid = appState.parentSelectedKidProfile || { name: 'Bé' };

      // 1. Cập nhật state mẹ
      appState.parentChildRoutineRoadmap = selected;
      
      // Nếu trong Dual mode mà máy con cũng đang là bé này thì cập nhật luôn máy con
      if (appState.childDeviceKidId === kidId) {
        if (!appState.completedRoutineIds) appState.completedRoutineIds = new Set();
        if (!appState.routinePhotoProofs) appState.routinePhotoProofs = {};
        selected.forEach(rt => {
          appState.completedRoutineIds.delete(rt.id);
          delete appState.routinePhotoProofs[rt.id];
        });
        appState.selectedActiveRoutineId = null;
        appState.currentRoutineIndex = 0;
        appState.childRoutineRoadmap = selected;
        if (typeof window.renderChildRoutineRoadmapFromTasks === 'function') {
          window.renderChildRoutineRoadmapFromTasks(selected);
        }
      }

      // 2. Gửi API lưu bền vững vào SQLite backend qua PUT /api/child/{kid_id}/state
      try {
        await fetch(`/api/child/${kidId}/state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routines: selected,
            completed_routine_ids: [],
            photo_proofs: {}
          })
        });
      } catch (err) {
        console.warn('Lỗi lưu routines lên server SQLite:', err);
      }

      // 3. Broadcast WebSocket cho máy con
      const bus = window.miloBus || window.syncBus;
      if (bus && typeof bus.broadcast === 'function') {
        bus.broadcast('ROUTINE_ASSIGN_BATCH', {
          target_kid_id: kidId,
          kid_id: kidId,
          routines: selected,
          resetCompletions: true,
          timestamp: Date.now()
        });
      }

      renderParentAuditTimeline();
      if (typeof renderParentActiveRoadmapList === 'function') {
        renderParentActiveRoadmapList();
      }

      showToast("Đã Giao Nề Nếp", `Mẹ vừa giao ${selected.length} thói quen nề nếp sang Đảo Thói Quen của ${currentKid.name}!`, "🌟");
    }

    function parentJumpToAssignRoutines() {
      parentSwitchTab('tasks');
      parentSwitchAssignMode('routines');
    }

    function renderParentAuditTimeline() {
      const container = document.getElementById('parent-audit-timeline-list');
      if (!container) return;
      container.innerHTML = '';

      const rateEl = document.getElementById('p-audit-stat-rate');
      const countEl = document.getElementById('p-audit-stat-count');
      const barEl = document.getElementById('p-audit-progress-bar');

      const isCleared = !!appState.routineCleared;
      const routines = window.routineDatabase || {};
      const rawList = isCleared ? [] : ((appState.parentChildRoutineRoadmap && appState.parentChildRoutineRoadmap.length > 0) ? appState.parentChildRoutineRoadmap : (appState.childRoutineRoadmap || []));
      const activeList = rawList.map(r => (typeof r === 'string' ? routines[r] : r)).filter(Boolean);

      // 1. EMPTY STATE KHI CHƯA GIAO THÓI QUEN
      if (activeList.length === 0) {
        if (rateEl) rateEl.innerText = "0/0 Hoàn Thành (0%)";
        if (countEl) countEl.innerText = "0";
        if (barEl) barEl.style.width = "0%";
        container.innerHTML = `
          <div class="bg-white rounded-3xl p-6 border-2 border-dashed border-slate-200 text-center flex flex-col items-center justify-center my-2 space-y-2">
            <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl">📋</div>
            <div class="font-black text-xs text-slate-800">Chưa có thói quen nào được giao hôm nay</div>
            <p class="text-[11px] text-slate-500 max-w-[240px]">Ba mẹ hãy bấm "Giao thêm thói quen" để chọn nề nếp sinh hoạt cho con nhé!</p>
          </div>
        `;
        return;
      }

      let completedCount = 0;

      activeList.forEach((rt) => {
        if (!rt) return;
        const card = document.createElement('div');
        const timeLocked = typeof isRoutineTimeLocked === 'function' ? isRoutineTimeLocked(rt) : false;
        const hasProof = !!(appState.routinePhotoProofs && appState.routinePhotoProofs[rt.id]);
        const isDone = appState.completedRoutineIds && appState.completedRoutineIds.has(rt.id) && (!timeLocked || hasProof);
        const isLocked = !isDone && timeLocked;
        const isCurrent = !isDone && !isLocked && (appState.activeTask && appState.activeTask.id === rt.id);
        const proof = (appState.routinePhotoProofs && appState.routinePhotoProofs[rt.id]) || null;

        if (isDone) completedCount++;

        if (isDone) {
          const thumbUrl = proof && (proof.photo_data || (Array.isArray(proof.photos) && proof.photos[0]));
          const photoCount = proof && Array.isArray(proof.photos) && proof.photos.length > 1 ? proof.photos.length : (thumbUrl ? 1 : 0);
          card.className = "bg-white rounded-2xl p-3 border border-slate-200 hover:border-teal-400 shadow-2xs flex items-center justify-between cursor-pointer transition active:scale-98";
          card.onclick = () => parentOpenPhotoModal(rt.id);
          card.innerHTML = `
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl ${thumbUrl ? 'overflow-hidden border-2 border-emerald-400 shadow-2xs relative' : 'bg-emerald-50 text-emerald-600'} flex items-center justify-center text-xl shrink-0">
                ${thumbUrl ? `<img src="${thumbUrl}" class="w-full h-full object-cover" alt="Thumb">` : (rt.icon || '🛏️')}
                ${photoCount > 1 ? `<span class="absolute bottom-0 right-0 bg-black/75 text-amber-300 font-black text-[8px] px-1 rounded-tl leading-tight">${photoCount}📷</span>` : ''}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-extrabold text-xs text-slate-800">${rt.title}</span>
                  <span class="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">✓ Xong</span>
                </div>
                <span class="text-[10px] text-slate-400 font-medium">Hoàn thành lúc ${proof && proof.timestamp ? proof.timestamp : (rt.slot_time || '07:00')} • +${rt.reward || 25}⭐</span>
              </div>
            </div>
            <span class="px-2.5 py-1 rounded-xl bg-teal-50 text-teal-700 text-[10px] font-black border border-teal-200 flex items-center gap-1 hover:bg-teal-100 transition">
              <span>📷</span> <span>${photoCount > 1 ? `${photoCount} Ảnh` : 'Xem Ảnh'}</span>
            </span>
          `;
        } else if (isCurrent) {
          card.className = "bg-amber-50/70 rounded-2xl p-3 border-2 border-dashed border-amber-300 flex items-center justify-between";
          card.innerHTML = `
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl shrink-0">
                ${rt.icon || '🧹'}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-extrabold text-xs text-amber-950">${rt.title}</span>
                  <span class="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded animate-pulse">⚡ Đang làm • ${rt.slot_time || '19:00'}</span>
                </div>
                <span class="text-[10px] text-amber-800 font-medium">Bé đang thực hiện bên Đảo Thói Quen...</span>
              </div>
            </div>
            <span class="text-xs">⏳</span>
          `;
        } else if (isLocked) {
          card.className = "bg-slate-50/80 rounded-2xl p-3 border border-slate-200 flex items-center justify-between opacity-80";
          card.innerHTML = `
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl shrink-0">
                🔒
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-extrabold text-xs text-slate-600">${rt.title}</span>
                  <span class="text-[9px] font-bold text-slate-500 bg-slate-200/80 px-1.5 py-0.2 rounded">Chưa tới giờ (${rt.slot_time || '19:00'})</span>
                </div>
                <span class="text-[10px] text-slate-400 font-medium">Khóa theo timeline • Chờ đến mốc giờ</span>
              </div>
            </div>
            <span class="text-xs text-slate-400">🔒</span>
          `;
        } else {
          card.className = "bg-white rounded-2xl p-3 border border-slate-200 flex items-center justify-between";
          card.innerHTML = `
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center text-xl shrink-0">
                ${rt.icon || '🌟'}
              </div>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-extrabold text-xs text-slate-800">${rt.title}</span>
                  <span class="text-[9px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded">Chưa thực hiện • ${rt.slot_time || '07:00'}</span>
                </div>
                <span class="text-[10px] text-slate-400 font-medium">Bé có thể quay lại làm bổ sung hoặc chuyển sang bài chiều</span>
              </div>
            </div>
            <span class="text-xs text-slate-400">⏳</span>
          `;
        }
        container.appendChild(card);
      });

      const total = activeList.length;
      const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

      if (rateEl) rateEl.innerText = `${completedCount}/${total} Hoàn Thành (${pct}%)`;
      if (countEl) countEl.innerText = completedCount;
      if (barEl) barEl.style.width = `${pct}%`;
    }

    window.renderParentAuditTimeline = renderParentAuditTimeline;
    window.renderParentRoutineAudit = renderParentAuditTimeline;

    function renderParentCatalogList() {
      const container = document.getElementById('catalog-tasks-list');
      if (!container) return;
      container.innerHTML = '';

      const catFilter = appState.catalogFilter || 'all';
      let gradeFilter = appState.gradeFilter || 'current_kid';

      const currentKid = appState.parentSelectedKidProfile || (appState.childrenList || []).find(c => c.kid_id === appState.parentSelectedKidId) || { grade: 1 };
      let effectiveGrade = gradeFilter;
      if (gradeFilter === 'current_kid') {
        effectiveGrade = currentKid.grade || 1;
      }

      // Deduplicate aliases (e.g. math_garden -> G1_MATH_01)
      const taskMap = new Map();
      Object.values(taskDatabase).forEach(t => {
        if (t && t.id) taskMap.set(t.id, t);
      });
      const tasks = Array.from(taskMap.values());

      tasks.forEach(t => {
        if (t.cat === 'chore' || t.cat === 'routine') return;
        
        // Khi chọn theo lớp (1,2,3,4,5 hoặc current_kid): chỉ hiển thị Toán, Tiếng Việt, Tiếng Anh
        if (effectiveGrade !== 'all') {
          if (t.grade !== effectiveGrade) return;
          if (!['math', 'viet', 'eng'].includes(t.cat)) return;
        }

        if (catFilter !== 'all' && t.cat !== catFilter) return;

        const isChecked = appState.selectedCatalogIds.has(t.id);
        const card = document.createElement('div');
        card.setAttribute('data-task-id', t.id);
        card.className = `bg-white rounded-2xl p-3 shadow-xs border transition flex items-center justify-between gap-2.5 overflow-hidden ${isChecked ? 'border-teal-400 bg-teal-50/20' : 'border-slate-200'}`;
        card.innerHTML = `
          <div class="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer" onclick="parentOpenTaskModal('${t.id}')">
            <span class="text-2xl shrink-0">${t.icon || '📚'}</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1 mb-0.5 flex-wrap">
                <span class="text-[9px] font-black uppercase px-2 py-0.2 rounded-full ${t.cat === 'math' ? 'bg-amber-100 text-amber-800' : t.cat === 'viet' ? 'bg-rose-100 text-rose-800' : t.cat === 'eng' ? 'bg-indigo-100 text-indigo-800' : 'bg-emerald-100 text-emerald-800'}">
                  ${t.catName || 'Nhiệm vụ'}
                </span>
                <span class="text-[9px] font-bold bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded-md">
                  Lớp ${t.grade || 1}
                </span>
                <span class="text-[10px] text-teal-600 font-bold ml-auto">Xem bước →</span>
              </div>
              <h4 class="font-bold text-slate-800 text-xs truncate">${t.title || 'Nhiệm vụ'}</h4>
              <div class="flex items-center gap-1 text-[10px] text-slate-500 mt-0.5 flex-wrap">
                <span class="font-bold text-teal-700">${(t.steps && t.steps.length) || 0} Micro-tasks</span>
                <span>•</span>
                <span class="font-bold text-amber-600">+${t.reward || 50} ⭐</span>
                <span>•</span>
                <span>~${Math.round(((t.stepSeconds || 60) * ((t.steps && t.steps.length) || 1)) / 60)} phút</span>
              </div>
            </div>
          </div>
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleCatalogItem('${t.id}', this.checked)" class="w-5 h-5 accent-teal-600 cursor-pointer shrink-0 ml-2" />
        `;
        container.appendChild(card);
      });

      updateBatchSummaryUI();
    }
    const renderCatalogTaskCards = renderParentCatalogList;

    function parentFilterGrade(grade) {
      if (grade !== 'current_kid') playSfx('tap');
      appState.gradeFilter = grade;
      const currentKid = appState.parentSelectedKidProfile || (appState.childrenList || []).find(c => c.kid_id === appState.parentSelectedKidId) || { grade: 1 };
      const kidGrade = currentKid.grade || 1;
      
      const labelKid = document.getElementById('label-p-grade-kid');
      if (labelKid) {
        labelKid.innerText = `🎯 Lớp của bé (Lớp ${kidGrade})`;
      }

      const allGradeKeys = ['kid', 1, 2, 3, 4, 5, 'all'];
      allGradeKeys.forEach(k => {
        const btn = document.getElementById(`p-grade-${k}`);
        if (!btn) return;
        const isMatch = (k === 'kid' && grade === 'current_kid') || (k === grade) || (k === 'all' && grade === 'all');
        if (isMatch) {
          if (k === 'all') {
            btn.className = "px-2.5 py-0.5 rounded-lg bg-amber-500 text-white border border-amber-600 shrink-0 text-[10px] font-black shadow-xs flex items-center gap-1 cursor-pointer";
          } else {
            btn.className = "px-2.5 py-0.5 rounded-lg bg-teal-600 text-white shrink-0 text-[10px] font-black shadow-xs flex items-center gap-1 cursor-pointer";
          }
        } else {
          if (k === 'all') {
            btn.className = "px-2.5 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 shrink-0 text-[10px] font-black flex items-center gap-1 cursor-pointer";
          } else {
            btn.className = "px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 shrink-0 text-[10px] cursor-pointer";
          }
        }
      });
      renderParentCatalogList();
    }

    function toggleCatalogItem(id, isChecked) {
      playSfx('tap');
      if (isChecked) {
        appState.selectedCatalogIds.add(id);
      } else {
        appState.selectedCatalogIds.delete(id);
      }
      renderParentCatalogList();
      if (window.miloBus) window.miloBus.savePersistedState(appState);
    }

    function parentFilterCatalog(cat) {
      playSfx('tap');
      appState.catalogFilter = cat;
      ['all', 'math', 'viet', 'eng'].forEach(c => {
        const btn = document.getElementById(`p-cat-${c}`);
        if (c === cat) {
          btn.className = "px-2.5 py-1 rounded-xl bg-teal-600 text-white shrink-0";
        } else {
          btn.className = "px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0";
        }
      });
      renderParentCatalogList();
    }

    function selectAllCatalog(selectAll) {
      playSfx('tap');
      if (selectAll) {
        let catFilter = appState.catalogFilter || 'all';
        let gradeFilter = appState.gradeFilter || 'current_kid';
        const currentKid = appState.parentSelectedKidProfile || (appState.childrenList || []).find(c => c.kid_id === appState.parentSelectedKidId) || { grade: 1 };
        let effectiveGrade = gradeFilter === 'current_kid' ? (currentKid.grade || 1) : gradeFilter;

        const taskMap = new Map();
        Object.values(taskDatabase).forEach(t => {
          if (t && t.id) taskMap.set(t.id, t);
        });
        taskMap.forEach(t => {
          if (t.cat === 'chore' || t.cat === 'routine') return;
          if (effectiveGrade !== 'all') {
            if (t.grade !== effectiveGrade) return;
            if (!['math', 'viet', 'eng'].includes(t.cat)) return;
          }
          if (catFilter !== 'all' && t.cat !== catFilter) return;
          appState.selectedCatalogIds.add(t.id);
        });
      } else {
        appState.selectedCatalogIds.clear();
      }
      renderParentCatalogList();
      if (window.miloBus) window.miloBus.savePersistedState(appState);
    }

    function updateBatchSummaryUI() {
      const selected = Array.from(appState.selectedCatalogIds).map(id => taskDatabase[id]).filter(Boolean);
      const count = selected.length;
      let totalSteps = 0;
      let totalStars = 0;
      let totalMinutes = 0;

      selected.forEach(t => {
        totalSteps += t.steps.length;
        totalStars += t.reward;
        totalMinutes += Math.round((t.steps.length * t.stepSeconds) / 60);
      });

      document.getElementById('batch-selected-count').innerText = count;
      document.getElementById('batch-selected-meta').innerText = `${totalSteps} bước • ~${totalMinutes} phút • +${totalStars} ⭐`;
    }

    // BẮN LÔ BÀI TẬP ĐÃ CHỌN SANG MÁY CON TẠO LỘ TRÌNH ĐẢO
    async function dispatchSelectedCatalogTasks() {
      playSfx('bell');
      appState.roadmapCleared = false;
      try { if (typeof localStorage !== 'undefined') localStorage.removeItem('milo_roadmap_cleared'); } catch(_) {}
      const selectedTasks = Array.from(appState.selectedCatalogIds).map(id => taskDatabase[id]).filter(Boolean);
      if (selectedTasks.length === 0) {
        alert("Vui lòng tick chọn ít nhất 1 bài tập!");
        return;
      }

      const kidId = appState.parentSelectedKidId || 'kid_leo_01';
      const currentKid = appState.parentSelectedKidProfile || { name: 'Bé' };
      const currentGrade = currentKid.grade || 1;

      // Lọc nghiêm ngặt: nếu có bài thuộc đúng lớp của bé thì chỉ giao bài đúng lớp, loại bỏ bài rác lớp khác
      const matchingGradeTasks = selectedTasks.filter(t => t.grade === currentGrade);
      const tasksToDispatch = (matchingGradeTasks.length > 0) ? matchingGradeTasks : selectedTasks;

      // 1. Cập nhật state mẹ
      appState.parentChildRoadmap = tasksToDispatch;
      appState.parentCurrentRoadmapIndex = 0;
      if (!appState.childrenStates) appState.childrenStates = {};
      if (!appState.childrenStates[kidId]) appState.childrenStates[kidId] = {};
      appState.childrenStates[kidId].child_roadmap = tasksToDispatch;
      appState.childrenStates[kidId].current_roadmap_index = 0;
      
      // Nếu trong Dual mode mà máy con cũng đang là bé này thì cập nhật luôn máy con
      if (appState.childDeviceKidId === kidId) {
        appState.childRoadmap = tasksToDispatch;
        appState.currentRoadmapIndex = 0;
        appState.activeTask = tasksToDispatch[0];
        if (typeof renderChildIslandRoadmap === 'function') renderChildIslandRoadmap();
      }

      // 2. Gửi API lưu bền vững vào SQLite backend
      try {
        await fetch('/api/tasks/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parent_id: 'parent_lan_01',
            kid_id: kidId,
            task_ids: tasksToDispatch.map(t => t.id)
          })
        });
      } catch (e) {
        console.warn('Dispatch API error:', e);
      }

      // 3. Broadcast WebSocket cho thiết bị con của bé này
      if (window.miloBus && typeof window.miloBus.broadcast === 'function') {
        window.miloBus.broadcast('TASK_ASSIGN_BATCH', {
          target_kid_id: kidId,
          kid_id: kidId,
          tasks: tasksToDispatch,
          islandName: `Hải Trình ${tasksToDispatch.length} Đảo Tri Thức`,
          dispatchId: 'DISPATCH_' + Date.now()
        });
      }

      // 4. DỌN DẸP SẠCH TICK SELECTION SAU KHI GIAO THÀNH CÔNG (Tránh chèn lại bài cũ)
      appState.selectedCatalogIds.clear();
      if (appState.childrenStates && appState.childrenStates[kidId]) {
        appState.childrenStates[kidId].selectedCatalogIds = new Set();
      }
      if (window.miloBus && typeof window.miloBus.savePersistedState === 'function') {
        window.miloBus.savePersistedState(appState);
      }
      renderParentCatalogList();
      updateBatchSummaryUI();

      renderParentActiveRoadmapList();
      showToast("Lộ Trình Đã Giao!", `Mẹ vừa giao lô ${tasksToDispatch.length} bài tập sang hải trình của ${currentKid.name}!`, "🚀");
    }

    // Modal chi tiết bước bên phía mẹ
    function parentOpenTaskModal(key) {
      playSfx('tap');
      appState.modalTaskKey = key;
      const task = taskDatabase[key];
      if (!task) return;

      document.getElementById('parent-modal-cat').innerText = task.catName;
      document.getElementById('parent-modal-title').innerText = task.title;
      document.getElementById('parent-modal-steps-count').innerText = `${task.steps.length} Micro-tasks`;
      document.getElementById('parent-modal-reward').innerText = `+${task.reward} ⭐`;

      const stepsList = document.getElementById('parent-modal-steps');
      stepsList.innerHTML = '';
      task.steps.forEach((s, idx) => {
        const item = document.createElement('div');
        item.className = "bg-slate-50 border border-slate-200 p-2 rounded-xl";
        item.innerHTML = `
          <div class="flex items-center gap-1.5 text-[10px] font-bold text-teal-800 mb-0.5">
            <span class="w-4 h-4 rounded-full bg-teal-600 text-white flex items-center justify-center text-[9px]">${idx + 1}</span>
            <span>${s.badge}</span>
          </div>
          <p class="text-slate-600 text-[11px] leading-snug pl-5">${s.text}</p>
        `;
        stepsList.appendChild(item);
      });

      const modal = document.getElementById('parent-task-modal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function parentCloseTaskModal() {
      playSfx('tap');
      const modal = document.getElementById('parent-task-modal');
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    function parentDispatchActiveModalTask() {
      playSfx('bell');
      const task = taskDatabase[appState.modalTaskKey];
      if (!task) return;
      const btn = document.getElementById('parent-modal-dispatch-btn');
      btn.innerText = "✅ ĐÃ BẮN SANG HẢI TRÌNH CỦA CON!";
      btn.className = "w-full py-3 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md";

      setTimeout(async () => {
        parentCloseTaskModal();
        btn.innerText = "GỬI SANG MÁY CỦA CON 🚀";
        btn.className = "w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-md transition";
        
        const kidId = appState.parentSelectedKidId || 'kid_leo_01';
        const currentKid = appState.parentSelectedKidProfile || { name: 'Bé' };

        // 1. Cập nhật state mẹ
        appState.parentChildRoadmap = [task];
        appState.parentCurrentRoadmapIndex = 0;
        if (!appState.childrenStates) appState.childrenStates = {};
        if (!appState.childrenStates[kidId]) appState.childrenStates[kidId] = {};
        appState.childrenStates[kidId].child_roadmap = [task];
        appState.childrenStates[kidId].current_roadmap_index = 0;
        if (typeof renderParentActiveRoadmapList === 'function') renderParentActiveRoadmapList();

        // 2. Nếu trong dual mode máy con cũng là bé này thì cập nhật máy con
        if (appState.childDeviceKidId === kidId) {
          appState.childRoadmap = [task];
          appState.currentRoadmapIndex = 0;
          appState.activeTask = task;
          appState.currentStepIndex = 0;
          if (typeof renderChildIslandRoadmap === 'function') renderChildIslandRoadmap();
          if (typeof childSwitchScreen === 'function') childSwitchScreen('home');
        }

        // 3. Lưu SQLite
        try {
          await fetch('/api/tasks/dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              parent_id: 'parent_lan_01',
              kid_id: kidId,
              task_ids: [task.id]
            })
          });
        } catch (_) {}

        // 4. Broadcast qua WebSocket / MiloSyncBus
        if (window.miloBus) {
          window.miloBus.broadcast('TASK_ASSIGN_BATCH', {
            target_kid_id: kidId,
            kid_id: kidId,
            tasks: [task],
            islandName: `Đảo Thử Thách: ${task.title}`,
            dispatchId: 'DISPATCH_' + Date.now()
          });
        }

        showToast("Nhiệm Vụ Mới Nhận", `Mẹ vừa giao cho ${currentKid.name}: ${task.title} (${task.steps.length} bước)`, "🚀");
      }, 700);
    }


    /* ============================================================
       L. HƯỚNG 2: TỰ GIAO (AI TỰ BĂM & SOẠN BẰNG TAY ĐỘNG)
       ============================================================ */

    /* ============================================================
       M. TABS PHỤ HUYNH & PHÊ DUYỆT VÉ VÀNG
       ============================================================ */
    function parentSwitchTab(tabName) {
      playSfx('tap');
      const tabs = ['home', 'tasks', 'routines', 'rewards', 'profile'];
      tabs.forEach(t => {
        const sec = document.getElementById(`parent-screen-${t}`);
        const nav = document.getElementById(`p-nav-${t}`);
        if (sec) {
          if (t === tabName) {
            sec.classList.remove('hidden');
            sec.classList.add(t === 'profile' ? 'flex' : 'block');
            sec.style.display = (t === 'profile' ? 'flex' : 'block');
          } else {
            sec.classList.add('hidden');
            sec.classList.remove('flex', 'block');
            sec.style.display = 'none';
          }
        }
        if (nav) {
          if (t === tabName) {
            nav.className = "flex flex-col items-center py-1 text-teal-600 font-bold text-[10px]";
          } else {
            nav.className = "flex flex-col items-center py-1 text-slate-400 hover:text-slate-600 font-bold text-[10px]";
          }
        }
      });

      if (tabName === 'rewards') {
        const dot = document.getElementById('p-reward-dot');
        if (dot) dot.classList.add('hidden');
      }
      if (tabName === 'routines') {
        if (typeof renderParentAuditTimeline === 'function') {
          renderParentAuditTimeline();
        }
      }
      if (tabName === 'profile') {
        if (typeof renderParentProfileCards === 'function') {
          renderParentProfileCards();
        }
      }
    }

    function copyParentScript() {
      playSfx('tap');
      const text = document.getElementById('parent-praise-script').innerText;
      navigator.clipboard?.writeText(text);
      showToast("Đã Sao Chép Lời Khen", "Mẹ hãy đọc to hoặc gửi tin nhắn ngọt ngào cho Leo nhé!", "📋");
    }

    function parentApproveTicket() {
      playSfx('success');
      const banner = document.getElementById('parent-golden-ticket-banner');
      const doneBanner = document.getElementById('parent-golden-ticket-done');
      if (banner) banner.classList.add('hidden');
      if (doneBanner) doneBanner.classList.remove('hidden');

      const ticketTitle = appState.pendingTicket ? appState.pendingTicket.title : "30 phút chơi Lego cùng mẹ Lan";
      const praiseMsg = "Mẹ rất tự hào về sự kiên trì vượt các đảo hôm nay của Leo!";

      // Broadcast TICKET_APPROVAL_RESPONSE
      if (window.miloBus) {
        window.miloBus.broadcast('TICKET_APPROVAL_RESPONSE', {
          ticketId: appState.pendingTicket ? appState.pendingTicket.ticketId : 'ticket_01',
          title: ticketTitle,
          approved: true,
          praiseMessage: praiseMsg
        });
        appState.pendingTicket = null;
        window.miloBus.savePersistedState(appState);
      }

      showToast("Đã Duyệt Vé Vàng!", "Lời khen ngợi và phê duyệt đã bắn ngay sang điện thoại của Leo!", "🎉");
    }

    function parentSendCheer(customText) {
      playSfx('tap');
      const scriptEl = document.getElementById('parent-praise-script');
      const text = customText || (scriptEl ? scriptEl.innerText : "") || "Mẹ rất tự hào về sự kiên trì của con!";
      if (window.miloBus) {
        window.miloBus.broadcast('PARENT_CHEER_SEND', {
          cheerText: text,
          message: text,
          sticker: 'milo_thumbs_up'
        });
      }
      showToast("Đã Gửi Lời Khen", "Lời khen ngợi nỗ lực đã xuất hiện trên buồng lái của Leo! ❤️", "💌");
    }

    function parentDeclineTicket() {
      playSfx('tap');
      document.getElementById('parent-golden-ticket-banner').classList.add('hidden');
      showToast("Để Phê Duyệt Sau", "Yêu cầu đổi quà đã được lưu trong danh sách chờ duyệt.", "⏳");
    }

    function parentAddCustomReward() {
      const title = document.getElementById('new-reward-title').value.trim();
      const stars = parseInt(document.getElementById('new-reward-stars').value) || 300;
      if (!title) return;

      playSfx('tap');
      const list = document.getElementById('parent-reward-list');
      const item = document.createElement('div');
      item.className = 'bg-white rounded-2xl p-3 shadow-xs border border-teal-200 flex items-center justify-between';
      item.innerHTML = `
        <div class="flex items-center gap-2.5">
          <span class="text-xl bg-teal-50 w-9 h-9 rounded-xl flex items-center justify-center">🎁</span>
          <div>
            <h4 class="font-bold text-xs text-slate-800">${title}</h4>
            <span class="text-[11px] font-bold text-amber-600">${stars} ⭐</span>
          </div>
        </div>
        <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Đang kích hoạt</span>
      `;
      list.prepend(item);
      document.getElementById('new-reward-title').value = "";
      showToast("Thêm Vé Vàng", `Đã kích hoạt phần thưởng [${title}] cho bé!`, "🎁");
    }

    // AI Coach Chat
    function parentSendSituation(type) {
      playSfx('tap');
      const box = document.getElementById('parent-chat-box');
      const data = {
        tantrum: {
          q: "😤 Con đang cáu gắt không chịu ngồi vào bàn",
          s1: '"Mẹ thấy Leo đang rất khó chịu và mệt mỏi đúng không con? Không sao cả."',
          s2: '"Con uống 1 ngụm nước mát nhé, hai mẹ con mình chỉ làm đúng Bước 1 trong 3 phút thôi rồi nghỉ!"'
        },
        quit: {
          q: "🛑 Con bỏ dở bài giữa chừng và nản",
          s1: '"Tuyệt vời! Leo đã tự kiên nhẫn làm xong bước đầu tiên rồi, pin não vừa báo cần sạc thêm đấy."',
          s2: '"Mình cùng bấm nút Tạm Dừng trên máy, vươn vai 5 phút rồi quay lại lấy nốt Sao nhé!"'
        },
        praise: {
          q: "⭐ Cách khen nỗ lực khi con hoàn thành",
          s1: '"Hôm nay mẹ cực kỳ ấn tượng ở các bước làm bài, con vẫn rất kiên trì hoàn thành từng bước!"',
          s2: '"Con nhìn xem ví Sao vừa nhảy lên rồi kìa, đập tay ăn mừng nào!"'
        }
      }[type];

      box.innerHTML += `
        <div class="flex justify-end">
          <div class="bg-teal-600 text-white rounded-2xl rounded-br-none px-3 py-1.5 text-xs font-semibold max-w-[85%]">
            ${data.q}
          </div>
        </div>
        <div class="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-3 text-xs space-y-1.5 shadow-xs">
          <div class="bg-purple-50 border border-purple-100 p-2 rounded-xl text-purple-950">
            <strong class="block text-purple-800 text-[10px] mb-0.5">Bước 1 • Đồng cảm trước:</strong>
            ${data.s1}
          </div>
          <div class="bg-emerald-50 border border-emerald-100 p-2 rounded-xl text-emerald-950">
            <strong class="block text-emerald-800 text-[10px] mb-0.5">Bước 2 • Đặt giới hạn vi mô:</strong>
            ${data.s2}
          </div>
        </div>
      `;
      box.scrollTop = box.scrollHeight;
    }

    function parentAskCoach() {
      const inp = document.getElementById('coach-user-input');
      const val = inp.value.trim();
      if (!val) return;

      playSfx('tap');
      const box = document.getElementById('parent-chat-box');
      box.innerHTML += `
        <div class="flex justify-end">
          <div class="bg-teal-600 text-white rounded-2xl rounded-br-none px-3 py-1.5 text-xs font-semibold max-w-[85%]">
            ${val}
          </div>
        </div>
      `;
      inp.value = "";
      box.scrollTop = box.scrollHeight;

      // Intelligent context-aware coach response based on actual child state
      const task = appState.activeTask || {};
      const stepIdx = appState.currentStepIndex || 0;
      const taskTitle = task.title || "bài tập";
      const qLower = val.toLowerCase();

      let reply = "";
      if (qLower.includes("cáu") || qLower.includes("khóc") || qLower.includes("nản") || qLower.includes("không chịu") || qLower.includes("mệt")) {
        reply = `Leo đang đối mặt với việc cạn kiệt năng lượng chú ý ở [${taskTitle}]. Đây là phản ứng thần kinh bình thường khi hạch hạnh nhân (Amygdala) bị quá tải. Mẹ hãy dùng quy tắc <strong>Đồng cảm 2 phút</strong>: 'Mẹ thấy con đang rất mệt đúng không? Con uống ngụm nước nhé, hai mẹ con chỉ giải quyết nốt 1 ô này thôi rồi dừng!'. Tuyệt đối không quát mắng lúc này mẹ nhé!`;
      } else if (qLower.includes("khen") || qLower.includes("thưởng") || qLower.includes("động viên")) {
        reply = `Khi Leo hoàn thành Bước ${stepIdx + 1} của [${taskTitle}], mẹ hãy áp dụng kỹ thuật <strong>Khen ngợi nỗ lực cụ thể (Effort Praise)</strong> thay vì khen kết quả: 'Mẹ nhìn thấy sự kiên trì của Leo khi đặt từng phép tính rất thẳng hàng!'. Điều này sẽ kích hoạt thụ thể Dopamine D2 bền vững, giúp bé xây dựng động lực nội tại.`;
      } else if (qLower.includes("toán") || qLower.includes("tính") || qLower.includes("nhân") || qLower.includes("cộng")) {
        reply = `Ở bài toán [${taskTitle}], bí quyết cho trẻ ADHD là <strong>ngoại hóa bộ nhớ làm việc</strong>. Nhờ có lưới ô vuông từng chữ số và cơ chế nhập từ phải sang trái, não bộ bé không cần phải 'tưởng tượng' các cột số trong đầu nữa. Mẹ chỉ cần quan sát và khích lệ bé từng dòng một nhé!`;
      } else if (qLower.includes("tiếng anh") || qLower.includes("đọc") || qLower.includes("văn")) {
        reply = `Với bài đọc hiểu, điểm nghẽn lớn nhất của trẻ ADHD là 'ngợp trước bức tường chữ'. Hệ thống đã tách bài đọc và câu hỏi thành 2 phần độc lập để bé săn lùng từ khóa từng bước. Mẹ có thể gợi ý bé gạch chân đối tượng được hỏi trước nhé!`;
      } else {
        reply = `Milo Coach ghi nhận câu hỏi của mẹ! Hiện tại Leo đang thực hiện [${taskTitle}] (Bước ${stepIdx + 1}). Với trẻ ADHD, điều cốt lõi là <strong>hạ thấp rào cản hành động</strong> và chia nhỏ nhiệm vụ dưới 2 phút. Mẹ hãy cùng Milo theo dõi thanh đo nhịp tim nhận thức của bé nhé!`;
      }

      setTimeout(() => {
        playSfx('bell');
        box.innerHTML += `
          <div class="bg-white border border-slate-200 rounded-2xl rounded-bl-none p-3 text-xs space-y-1.5 shadow-xs">
            <div class="flex items-center gap-1.5 text-teal-700 font-bold text-[11px]">
              <span>🤖</span> <span>Milo Coach Phản Hồi:</span>
            </div>
            <p class="text-slate-600 text-[11px] leading-relaxed">
              ${reply}
            </p>
          </div>
        `;
        box.scrollTop = box.scrollHeight;
      }, 350);
    }


    /* ============================================================
       M2. BẢNG KHẢO SÁT CHẨN ĐOÁN PHỤ HUYNH & HỒ SƠ NHẬN THỨC (VADPRS / SNAP-IV 9 CÂU)
       ============================================================ */
    const ADHD_SURVEY_QUESTIONS = [
      {
        id: "q1",
        dimension: "executive_function",
        dimensionName: "Chức năng Điều hành",
        subTrait: "Trí nhớ làm việc (Working Memory)",
        promptText: "Khi con được giao bài tập có từ 2 đến 3 yêu cầu liên tiếp (ví dụ: 'Đọc đoạn văn, gạch chân từ chỉ hoạt động rồi trả lời câu hỏi 1'), con có hay bị quên các bước tiếp theo hoặc chỉ làm được bước đầu tiên rồi dừng lại không?",
        behavioralAnchor: "Trẻ không ghi nhớ được chuỗi hành động trong đầu, cần phụ huynh phải nhắc đi nhắc lại từng bước một."
      },
      {
        id: "q2",
        dimension: "executive_function",
        dimensionName: "Chức năng Điều hành",
        subTrait: "Khởi động nhiệm vụ (Task Initiation)",
        promptText: "Khi bắt đầu ngồi vào bàn học, con có loay hoay rất lâu (như liên tục đi uống nước, tìm bút, gọt bút chì, ngó nghiêng đồ vật) hoặc bị 'đóng băng', không biết bắt đầu từ đâu dù bài tập không quá khó không?",
        behavioralAnchor: "Trẻ trì hoãn khởi động, cần 15-30 phút chỉ để đặt bút viết chữ đầu tiên."
      },
      {
        id: "q3",
        dimension: "executive_function",
        dimensionName: "Chức năng Điều hành",
        subTrait: "Kiểm soát ức chế & Lập kế hoạch",
        promptText: "Con có xu hướng vội vàng viết đáp án ngay khi chưa đọc hết câu hỏi, bỏ qua bước tính toán ngoài nháp hoặc đột ngột chuyển sang làm việc khác giữa chừng mà không kiểm soát được không?",
        behavioralAnchor: "Trẻ hấp tấp, thiếu bước kiểm tra lại bài, hành động trước khi suy nghĩ."
      },
      {
        id: "q4",
        dimension: "attention_span",
        dimensionName: "Khoảng Chú ý & Kháng Nhiễu",
        subTrait: "Chú ý duy trì liên tục",
        promptText: "Khoảng thời gian con có thể ngồi tập trung liên tục vào một bài tập học thuật (không đổi tư thế, không ngắt quãng) thường ngắn đến mức nào (ví dụ: chỉ duy trì được dưới 5 đến 10 phút là bắt đầu bồn chồn, ngáp hoặc nhìn đi nơi khác)?",
        behavioralAnchor: "Sự suy giảm chú ý diễn ra nhanh chóng sau vài phút đối diện bài tập có cấu trúc."
      },
      {
        id: "q5",
        dimension: "attention_span",
        dimensionName: "Khoảng Chú ý & Kháng Nhiễu",
        subTrait: "Kháng nhiễu ngoại lai",
        promptText: "Khi đang làm bài tập, chỉ cần một tiếng động nhỏ (tiếng nói chuyện nhẹ, tiếng xe ngoài ngõ, tivi ở phòng bên) hoặc một đồ vật chuyển động trong tầm mắt, con có lập tức bị phân tán và mất luôn dòng suy nghĩ không?",
        behavioralAnchor: "Bộ lọc cảm giác yếu, trẻ phản ứng với mọi biến đổi của môi trường xung quanh."
      },
      {
        id: "q6",
        dimension: "attention_span",
        dimensionName: "Khoảng Chú ý & Kháng Nhiễu",
        subTrait: "Duy trì quán tính hoàn thành bài",
        promptText: "Con có thường xuyên để bài tập ở trạng thái dở dang (ví dụ: làm được nửa bài toán hoặc viết được vài dòng chính tả thì dừng lại, bỏ đi chơi hoặc vẽ linh tinh vào lề vở) dù chưa hết giờ không?",
        behavioralAnchor: "Đứt gãy động lực giữa chừng do chiết khấu trì hoãn và thiếu hụt dopamine."
      },
      {
        id: "q7",
        dimension: "rsd_sensitivity",
        dimensionName: "Độ Nhạy Cảm Thất Bại (RSD)",
        subTrait: "Nỗi sợ làm sai & Cầu toàn tiêu cực",
        promptText: "Con có biểu hiện quá lo lắng về việc bị sai (ví dụ: liên tục tẩy xóa đến rách vở, hỏi đi hỏi lại 'con làm thế này có bị sai không mẹ', hoặc ngập ngừng không dám tự điền đáp án vì sợ sai) không?",
        behavioralAnchor: "Nỗi sợ thất bại gây ức chế hành động, tạo ra cảm giác bất an khi đối diện bài tập đánh giá."
      },
      {
        id: "q8",
        dimension: "rsd_sensitivity",
        dimensionName: "Độ Nhạy Cảm Thất Bại (RSD)",
        subTrait: "Phản ứng cảm xúc khi bị sửa bài",
        promptText: "Khi ba mẹ hoặc thầy cô chỉ ra chỗ con làm sai hoặc nhắc con sửa lại, con có dễ nảy sinh phản ứng gay gắt (như cáu kỉnh, khóc òa, tự ái, xé nháp hoặc giận dỗi nói 'con dốt lắm / con không làm nữa') không?",
        behavioralAnchor: "Hạch hạnh nhân kích hoạt quá mức trước phản hồi tiêu cực, coi việc sửa sai như một sự từ chối cá nhân."
      },
      {
        id: "q9",
        dimension: "rsd_sensitivity",
        dimensionName: "Độ Nhạy Cảm Thất Bại (RSD)",
        subTrait: "Ngưỡng chịu đựng thất vọng",
        promptText: "Khi gặp một câu hỏi hóc búa hoặc chưa hiểu ngay cách giải, con có nhanh chóng nản lòng, bực tức và lập tức buông xuôi, từ chối thử sức tiếp không?",
        behavioralAnchor: "Trẻ né tránh sự thất vọng bằng cách từ bỏ ngay lập tức để bảo vệ lòng tự trọng bị đe dọa."
      }
    ];

    const ADHD_LIKERT_OPTIONS = [
      { value: 0, label: "Không bao giờ" },
      { value: 1, label: "Thỉnh thoảng" },
      { value: 2, label: "Thường xuyên" },
      { value: 3, label: "Rất thường xuyên" }
    ];

    function resolveScaffoldingTier(cdi, wm) {
      if (cdi >= 0.75 || wm <= 1) {
        return {
          tier_id: 1,
          scaffolding_tier: "TIER_1_ULTRA_ATOMIC",
          tier_name: "Siêu phân rã (Ultra-Atomic)",
          scaffolding_level: "INTENSIVE",
          target_step_count: 5,
          option_count: 2,
          auto_hint_delay_sec: 12,
          error_masking: true,
          pedagogical_focus: "Băm nhỏ tối đa 5 bước, mỗi bước 1 thao tác cơ học duy nhất, 1 động từ đơn."
        };
      } else if (cdi >= 0.55 || wm === 2) {
        return {
          tier_id: 2,
          scaffolding_tier: "TIER_2_HIGH_SCAFFOLD",
          tier_name: "Giàn giáo chuyên sâu (High Scaffold)",
          scaffolding_level: "INTENSIVE",
          target_step_count: 4,
          option_count: 3,
          auto_hint_delay_sec: 20,
          error_masking: true,
          pedagogical_focus: "Chuẩn 4 bước GDPT 2018: Gạch chân đầy đủ -> Cầu nối nhận thức -> Chọn phép tính -> Tính toán."
        };
      } else if (cdi >= 0.35 || wm === 3) {
        return {
          tier_id: 3,
          scaffolding_tier: "TIER_3_BALANCED",
          tier_name: "Giàn giáo cân bằng (Balanced)",
          scaffolding_level: "MODERATE",
          target_step_count: 3,
          option_count: 4,
          auto_hint_delay_sec: 0,
          error_masking: false,
          pedagogical_focus: "Rút gọn thành 3 bước: Đọc và chọn phép tính -> Đặt tính và tính nhẩm -> Kết luận danh số."
        };
      } else if (cdi >= 0.20 || wm === 4) {
        return {
          tier_id: 4,
          scaffolding_tier: "TIER_4_GUIDED",
          tier_name: "Tự lập có hướng dẫn (Guided Independence)",
          scaffolding_level: "MINIMAL",
          target_step_count: 2,
          option_count: 4,
          auto_hint_delay_sec: 0,
          error_masking: false,
          pedagogical_focus: "Rút xuống 2 bước: Tự lập biểu thức và tính đáp số trong 1 card -> Ghi đáp số đầy đủ."
        };
      } else {
        return {
          tier_id: 5,
          scaffolding_tier: "TIER_5_MASTERY",
          tier_name: "Tự chủ & Mở rộng (Full Mastery)",
          scaffolding_level: "MINIMAL",
          target_step_count: 1,
          option_count: 4,
          auto_hint_delay_sec: 0,
          error_masking: false,
          pedagogical_focus: "Trẻ tự lập hoàn toàn: 1 bước giải trọn vẹn và 1 câu hỏi thử thách mở rộng."
        };
      }
    }
    if (typeof window !== 'undefined') window.resolveScaffoldingTier = resolveScaffoldingTier;

    function adaptiveUpdateCognitiveProfile(currentProfile, telemetryData, alpha = 0.15, maxDelta = 0.10) {
      if (!currentProfile) currentProfile = (typeof appState !== 'undefined' && appState.cognitiveProfile) || {};
      if (!telemetryData) telemetryData = {};

      const norm = currentProfile.normalized_indices || {};
      let cur_ef = norm.executive_function_deficit_index !== undefined ? Number(norm.executive_function_deficit_index) : 0.5;
      let cur_as = norm.attention_decay_index !== undefined ? Number(norm.attention_decay_index) : 0.5;
      let cur_rsd = norm.rejection_sensitivity_index !== undefined ? Number(norm.rejection_sensitivity_index) : 0.5;

      const t_init = Number(telemetryData.task_initiation_latency_sec !== undefined ? telemetryData.task_initiation_latency_sec : 5.0);
      const n_err = Number(telemetryData.mistakes_count !== undefined ? telemetryData.mistakes_count : 0);
      const n_hint = Number(telemetryData.hints_used !== undefined ? telemetryData.hints_used : 0);
      const actual_sec = Number(telemetryData.actual_duration_sec !== undefined ? telemetryData.actual_duration_sec : 60.0);
      const timer_sec = Number(telemetryData.timer_allocated_sec !== undefined ? telemetryData.timer_allocated_sec : 120.0);
      const focus_min = Number(telemetryData.focus_duration_min !== undefined ? telemetryData.focus_duration_min : 10.0);
      const t_freeze = Number(telemetryData.post_error_freeze_sec !== undefined ? telemetryData.post_error_freeze_sec : 0.0);
      const n_rescue = Number(telemetryData.milo_rescues_count !== undefined ? telemetryData.milo_rescues_count : 0);
      const n_abandon = Number(telemetryData.abandoned_count !== undefined ? telemetryData.abandoned_count : 0);

      // Empirical Observations
      const obs_ef = Math.max(0.0, Math.min(1.0, 
        0.35 * Math.max(0.0, Math.min(1.0, (t_init - 3.0) / 20.0)) +
        0.40 * Math.min(1.0, n_err / 3.0) +
        0.25 * Math.min(1.0, n_hint / 3.0)
      ));

      const time_ratio = actual_sec / Math.max(1.0, timer_sec);
      const time_factor = Math.max(0.0, Math.min(1.0, (time_ratio - 0.5) / 1.0));
      const focus_factor = Math.max(0.0, Math.min(1.0, 1.0 - (focus_min / 15.0)));
      const obs_as = Math.max(0.0, Math.min(1.0, 0.60 * time_factor + 0.40 * focus_factor));

      const obs_rsd = Math.max(0.0, Math.min(1.0,
        (Math.min(1.0, t_freeze / 15.0) * 0.45) +
        (Math.min(1.0, n_rescue / 2.0) * 0.35) +
        (Math.min(1.0, n_abandon / 1.0) * 0.20)
      ));

      const delta_ef = Math.max(-maxDelta, Math.min(maxDelta, alpha * (obs_ef - cur_ef)));
      const delta_as = Math.max(-maxDelta, Math.min(maxDelta, alpha * (obs_as - cur_as)));
      const delta_rsd = Math.max(-maxDelta, Math.min(maxDelta, alpha * (obs_rsd - cur_rsd)));

      const new_ef = Math.round(Math.max(0.0, Math.min(1.0, cur_ef + delta_ef)) * 10000) / 10000;
      const new_as = Math.round(Math.max(0.0, Math.min(1.0, cur_as + delta_as)) * 10000) / 10000;
      const new_rsd = Math.round(Math.max(0.0, Math.min(1.0, cur_rsd + delta_rsd)) * 10000) / 10000;
      const new_cdi = Math.round(((0.40 * new_ef) + (0.35 * new_as) + (0.25 * new_rsd)) * 10000) / 10000;

      const attention_span_minutes = Math.max(5, Math.min(25, Math.round(25.0 - (new_as * 20.0))));
      const raw_micro_duration = 300.0 - (new_as * 210.0);
      const recommended_micro_task_duration_sec = Math.max(60, Math.min(300, Math.round(raw_micro_duration / 30.0) * 30));
      const working_memory_capacity = Math.max(1, Math.min(5, Math.round(5.0 - (new_ef * 4.0))));

      const rsd_raw = new_rsd * 9.0;
      const rsd_sensitivity_level = rsd_raw <= 2.0 ? "LOW" : rsd_raw <= 4.0 ? "MEDIUM" : rsd_raw <= 7.0 ? "HIGH" : "SEVERE";

      const tier_info = resolveScaffoldingTier(new_cdi, working_memory_capacity);

      const updated = Object.assign({}, currentProfile, {
        attention_span_minutes: attention_span_minutes,
        recommended_micro_task_duration_sec: recommended_micro_task_duration_sec,
        working_memory_capacity: working_memory_capacity,
        rsd_sensitivity_level: rsd_sensitivity_level,
        scaffolding_level: tier_info.scaffolding_level,
        scaffolding_tier: tier_info.scaffolding_tier,
        scaffolding_tier_info: tier_info,
        max_steps_per_session: tier_info.target_step_count,
        normalized_indices: {
          executive_function_deficit_index: new_ef,
          attention_decay_index: new_as,
          rejection_sensitivity_index: new_rsd,
          composite_deficit_index: new_cdi
        },
        raw_scores: {
          executive_function: Math.round(new_ef * 9.0 * 10) / 10,
          attention_span: Math.round(new_as * 9.0 * 10) / 10,
          rsd_sensitivity: Math.round(new_rsd * 9.0 * 10) / 10,
          total_score: Math.round((new_ef + new_as + new_rsd) * 9.0 * 10) / 10
        },
        last_telemetry_adaptive_time: Date.now()
      });

      if (typeof appState !== 'undefined') {
        appState.cognitiveProfile = updated;
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('milo_cognitive_profile', JSON.stringify(updated));
          }
        } catch(e) {}
      }

      if (typeof updateCognitiveProfileUI === 'function') {
        updateCognitiveProfileUI(updated);
      }

      return updated;
    }
    if (typeof window !== 'undefined') window.adaptiveUpdateCognitiveProfile = adaptiveUpdateCognitiveProfile;

    function calculateCognitiveProfileFromAnswers(answers) {
      let q = [];
      if (Array.isArray(answers)) {
        q = answers.map(Number);
      } else if (typeof answers === 'object' && answers !== null) {
        for (let i = 1; i <= 9; i++) {
          const v = answers[`q${i}`] !== undefined ? answers[`q${i}`] : answers[i];
          q.push(Number(v));
        }
      }
      if (q.length !== 9 || q.some(v => isNaN(v) || v < 0 || v > 3)) {
        throw new Error("Cần đủ 9 câu trả lời hợp lệ từ 0 đến 3");
      }

      // 1. Raw Subscale Scores
      const S_EF = q[0] + q[1] + q[2];
      const S_AS = q[3] + q[4] + q[5];
      const S_RSD = q[6] + q[7] + q[8];
      const S_total = S_EF + S_AS + S_RSD;

      // 2. Normalized Indices [0.0, 1.0]
      const I_EF = S_EF / 9.0;
      const I_AS = S_AS / 9.0;
      const I_RSD = S_RSD / 9.0;
      const CDI = 0.40 * I_EF + 0.35 * I_AS + 0.25 * I_RSD;

      // 3. CognitiveProfile Vector Mapping
      const attention_span_minutes = Math.max(5, Math.min(25, Math.round(25.0 - (S_AS / 9.0) * 20.0)));
      const recommended_micro_task_duration_sec = Math.min(300, Math.max(60, Math.round((300.0 - (S_AS / 9.0) * 210.0) / 30.0) * 30));
      const working_memory_capacity = Math.min(5, Math.max(1, Math.round(5.0 - (S_EF / 9.0) * 4.0)));
      const rsd_sensitivity_level = S_RSD <= 2 ? "LOW" : S_RSD <= 4 ? "MEDIUM" : S_RSD <= 7 ? "HIGH" : "SEVERE";
      const scaffolding_level = CDI < 0.35 ? "MINIMAL" : CDI < 0.70 ? "MODERATE" : "INTENSIVE";
      const max_steps_per_session = CDI < 0.35 ? 6 : CDI < 0.70 ? 4 : 3;
      const tier_info = resolveScaffoldingTier(CDI, working_memory_capacity);

      return {
        attention_span_minutes,
        recommended_micro_task_duration_sec,
        working_memory_capacity,
        rsd_sensitivity_level,
        scaffolding_level,
        scaffolding_tier: tier_info.scaffolding_tier,
        scaffolding_tier_info: tier_info,
        max_steps_per_session,
        raw_scores: {
          executive_function: S_EF,
          attention_span: S_AS,
          rsd_sensitivity: S_RSD,
          total_score: S_total
        },
        normalized_indices: {
          executive_function_deficit_index: Math.round(I_EF * 10000) / 10000,
          attention_decay_index: Math.round(I_AS * 10000) / 10000,
          rejection_sensitivity_index: Math.round(I_RSD * 10000) / 10000,
          composite_deficit_index: Math.round(CDI * 10000) / 10000
        }
      };
    }

    function updateCognitiveProfileUI(profile) {
      if (!profile) profile = appState.cognitiveProfile || DEFAULT_COGNITIVE_PROFILE;
      const tierName = (profile.scaffolding_tier_info && profile.scaffolding_tier_info.tier_name) || (profile.scaffolding_tier || "Bậc thích ứng");
      const badgeText = `🎯 ${tierName} • Chú ý ${profile.attention_span_minutes}p • Vi bước ${profile.recommended_micro_task_duration_sec}s`;
      const badgeEl = document.getElementById('parent-cognitive-badge');
      if (badgeEl) {
        badgeEl.textContent = badgeText;
      }
      const homeBadge = document.getElementById('parent-home-scaffold-badge');
      if (homeBadge) {
        homeBadge.textContent = profile.scaffolding_level;
      }
      const homeDesc = document.getElementById('parent-home-profile-desc');
      if (homeDesc) {
        homeDesc.textContent = `Chú ý ${profile.attention_span_minutes} phút • Vi bước ${profile.recommended_micro_task_duration_sec}s • Trí nhớ ${profile.working_memory_capacity} chunks`;
      }
    }

    function renderSurveyQuestions() {
      const container = document.getElementById('survey-questions-list');
      if (!container) return;

      let savedAnswers = appState.surveyAnswers;
      if (!savedAnswers) {
        try {
          if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem('milo_survey_answers');
            if (raw) savedAnswers = JSON.parse(raw);
          }
        } catch (e) {}
      }

      container.innerHTML = ADHD_SURVEY_QUESTIONS.map((q, idx) => {
        const qNum = idx + 1;
        const currentVal = savedAnswers && (savedAnswers[q.id] !== undefined ? savedAnswers[q.id] : savedAnswers[qNum]);
        return `
          <div id="survey-q-box-${qNum}" class="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                Câu ${qNum}: ${q.subTrait}
              </span>
              <span class="text-[9px] text-slate-400 font-semibold">${q.dimensionName}</span>
            </div>
            <p class="text-xs font-semibold text-slate-800 leading-relaxed">${q.promptText}</p>
            <p class="text-[10px] text-slate-500 italic bg-white/80 p-1.5 rounded-lg border border-slate-100">💡 ${q.behavioralAnchor}</p>
            <div class="grid grid-cols-2 gap-1.5 pt-1">
              ${ADHD_LIKERT_OPTIONS.map(opt => `
                <label class="flex items-center gap-1.5 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition text-[11px] font-medium text-slate-700 select-none">
                  <input type="radio" name="survey_${q.id}" value="${opt.value}" ${currentVal === opt.value ? 'checked' : ''} class="accent-teal-600 w-3.5 h-3.5 cursor-pointer">
                  <span>${opt.value}. ${opt.label}</span>
                </label>
              `).join('')}
            </div>
          </div>
        `;
      }).join('');
    }

    function openSurveyModal() {
      playSfx('tap');
      const modal = document.getElementById('parent-survey-modal');
      if (!modal) return;
      renderSurveyQuestions();
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }

    function closeSurveyModal() {
      playSfx('tap');
      const modal = document.getElementById('parent-survey-modal');
      if (!modal) return;
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }

    function saveSurveyAndCalculateProfile() {
      playSfx('tap');
      const answers = {};
      const answerList = [];
      for (let i = 1; i <= 9; i++) {
        const checked = document.querySelector(`input[name="survey_q${i}"]:checked`) || document.querySelector(`input[name="q${i}"]:checked`);
        if (!checked) {
          if (typeof showToast === 'function') {
            showToast("Chưa hoàn thành khảo sát", `Vui lòng trả lời câu ${i} trước khi lưu!`, "⚠️");
          } else {
            alert(`Vui lòng trả lời câu ${i} trước khi lưu!`);
          }
          const qBox = document.getElementById(`survey-q-box-${i}`);
          if (qBox && typeof qBox.scrollIntoView === 'function') {
            qBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        const val = parseInt(checked.value, 10);
        answers[`q${i}`] = val;
        answerList.push(val);
      }

      const profile = calculateCognitiveProfileFromAnswers(answerList);
      appState.cognitiveProfile = profile;
      appState.surveyAnswers = answers;

      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('milo_cognitive_profile', JSON.stringify(profile));
          localStorage.setItem('milo_survey_answers', JSON.stringify(answers));
        }
      } catch (err) {}

      updateCognitiveProfileUI(profile);
      closeSurveyModal();

      if (typeof showToast === 'function') {
        showToast("Hồ Sơ Đã Được Cập Nhật!", `Chú ý ${profile.attention_span_minutes}p • Vi bước ${profile.recommended_micro_task_duration_sec}s • RSD ${profile.rsd_sensitivity_level}`, "🎯");
      }
    }

    function skipSurveyWithDefaults() {
      playSfx('tap');
      appState.cognitiveProfile = Object.assign({}, DEFAULT_COGNITIVE_PROFILE);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('milo_cognitive_profile', JSON.stringify(appState.cognitiveProfile));
        }
      } catch (err) {}

      updateCognitiveProfileUI(appState.cognitiveProfile);
      closeSurveyModal();

      if (typeof showToast === 'function') {
        showToast("Đã Dùng Hồ Sơ Mặc Định", "Chú ý 12p • Vi bước 120s • RSD HIGH", "⚙️");
      }
    }

    // Expose survey APIs to window for inline onclick and test suites
    if (typeof window !== 'undefined') {
      window.openSurveyModal = openSurveyModal;
      window.closeSurveyModal = closeSurveyModal;
      window.saveSurveyAndCalculateProfile = saveSurveyAndCalculateProfile;
      window.skipSurveyWithDefaults = skipSurveyWithDefaults;
      window.calculateCognitiveProfileFromAnswers = calculateCognitiveProfileFromAnswers;
      window.DEFAULT_COGNITIVE_PROFILE = (typeof DEFAULT_COGNITIVE_PROFILE !== 'undefined') ? DEFAULT_COGNITIVE_PROFILE : (window.DEFAULT_COGNITIVE_PROFILE || {});
      window.updateCognitiveProfileUI = updateCognitiveProfileUI;
      window.renderSurveyQuestions = renderSurveyQuestions;
      window.loadStoredCognitiveProfile = loadStoredCognitiveProfile;
      window.ADHD_SURVEY_QUESTIONS = ADHD_SURVEY_QUESTIONS;
      window.ADHD_LIKERT_OPTIONS = ADHD_LIKERT_OPTIONS;
      window.detectDomainSubject = detectDomainSubject;
      window.generateClientSideMicroTasks = generateClientSideMicroTasks;
      window.parentRunAiBreakdown = parentRunAiBreakdown;
      window.tokenizeSentenceForHighlight = tokenizeSentenceForHighlight;
      window.toggleHighlightToken = toggleHighlightToken;
      window.completeHighlightStep = completeHighlightStep;
      window.toggleHighlightSegment = toggleHighlightSegment;
      window.normalizeAnswer = normalizeAnswer;
      window.handleChildTextInputSubmit = handleChildTextInputSubmit;
      window.renderParentActiveRoadmapList = renderParentActiveRoadmapList;
      window.parentRemoveRoadmapTask = parentRemoveRoadmapTask;
      window.parentClearChildRoadmap = parentClearChildRoadmap;
    }


// Global exports for routines management
window.parentSwitchAssignMode = parentSwitchAssignMode;
window.renderParentRoutinesCatalog = renderParentRoutinesCatalog;
window.parentFilterRoutines = parentFilterRoutines;
window.toggleRoutineItem = toggleRoutineItem;
window.selectAllRoutines = selectAllRoutines;
window.dispatchSelectedRoutines = dispatchSelectedRoutines;
window.renderParentAuditTimeline = renderParentAuditTimeline;
window.parentJumpToAssignRoutines = parentJumpToAssignRoutines;


    /* ============================================================
       FLEX-TIME & FLEX-MEAL PARENT CONFIGURATION HANDLERS
       ============================================================ */
    function saveRoutineCustomizations() {
      try {
        const routines = window.routineDatabase || {};
        const customs = {};
        Object.keys(routines).forEach(id => {
          const rt = routines[id];
          if (rt && (rt.slot_time || rt.flex_meal_config)) {
            customs[id] = {
              slot_time: rt.slot_time,
              flex_meal_config: rt.flex_meal_config,
              steps: rt.steps
            };
          }
        });
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('milo_routine_customizations', JSON.stringify(customs));
        }
      } catch (e) {}
    }

    function loadRoutineCustomizations() {
      try {
        if (typeof localStorage === 'undefined') return;
        const raw = localStorage.getItem('milo_routine_customizations');
        if (!raw) return;
        const customs = JSON.parse(raw);
        const routines = window.routineDatabase || {};
        Object.keys(customs).forEach(id => {
          if (routines[id] && customs[id]) {
            if (customs[id].slot_time) routines[id].slot_time = customs[id].slot_time;
            if (customs[id].flex_meal_config) routines[id].flex_meal_config = customs[id].flex_meal_config;
            if (customs[id].steps) routines[id].steps = customs[id].steps;
          }
        });
      } catch (e) {}
    }

    // Tự động phục hồi tùy chỉnh giờ & món ăn ngay khi nạp script
    loadRoutineCustomizations();

    function parentUpdateRoutineSlotTime(routineId, newTime) {
      if (!newTime) return;
      const routines = window.routineDatabase || {};
      if (routines[routineId]) {
        routines[routineId].slot_time = newTime;

        // Reset trạng thái hoàn thành cũ khi đổi sang khung giờ nhắc mới
        if (appState.completedRoutineIds) {
          appState.completedRoutineIds.delete(routineId);
        }
        if (appState.routinePhotoProofs) {
          delete appState.routinePhotoProofs[routineId];
        }

        // 1. Cập nhật nhãn giờ trên thẻ UI ngay lập tức
        const label = document.getElementById(`label-time-${routineId}`);
        if (label) label.innerText = newTime;

        // 2. Cập nhật trong lộ trình thói quen con nếu đang được giao
        if (Array.isArray(appState.childRoutineRoadmap)) {
          const targetInRoadmap = appState.childRoutineRoadmap.find(r => r && (r.id === routineId));
          if (targetInRoadmap) {
            targetInRoadmap.slot_time = newTime;
            if (typeof renderParentActiveRoadmapList === 'function') renderParentActiveRoadmapList();
            if (typeof window.renderChildRoutineRoadmapFromTasks === 'function') {
              window.renderChildRoutineRoadmapFromTasks(appState.childRoutineRoadmap);
            }
          }
        }

        // 3. Lưu bền vững vào localStorage & broadcast sync
        saveRoutineCustomizations();
        const bus = window.miloBus || window.syncBus;
        if (bus && typeof bus.savePersistedState === 'function') {
          bus.savePersistedState(appState);
        }

        if (typeof showToast === 'function') {
          showToast("Đã Đổi & Giữ Giờ Nhắc", `Thói quen [${routines[routineId].title}] sẽ nhắc con vào lúc ${newTime}!`, "⏱️");
        }
      }
    }

    function parentOpenFlexMealConfig(routineId) {
      if (typeof playSfx === 'function') playSfx('tap');
      const routines = window.routineDatabase || {};
      const rt = routines[routineId];
      if (!rt) return;

      const currentDishes = (rt.flex_meal_config && rt.flex_meal_config.dishes) 
        ? rt.flex_meal_config.dishes.map(d => `${d.name} (${d.minutes}p - ${d.device_name || d.device})`).join(', ')
        : 'Thịt kho (2p - Lò vi sóng), Canh rau (2p - Bếp đun)';

      const input = prompt(
        `🍗 SOẠN THỰC ĐƠN HÂM NÓNG CHO [${rt.title}]:\n` +
        `Nhập các món ăn mẹ để sẵn (Tên món - số phút - vi sóng/nồi chiên/bếp):\n` +
        `Ví dụ: Thịt kho - 2p - Lò vi sóng, Canh cải - 2p - Bếp, Sườn - 3p - Nồi chiên`,
        currentDishes
      );

      if (input && input.trim()) {
        const parts = input.split(/[,;\n]+/).map(p => p.trim()).filter(Boolean);
        const parsedDishes = [];
        const newSteps = [];

        parts.forEach((part, idx) => {
          // Parse name, minutes, device
          let name = part;
          let mins = 2;
          let device = 'microwave';
          let deviceName = 'Lò vi sóng';

          if (/nồi chiên|chiên|airfryer/i.test(part)) {
            device = 'airfryer';
            deviceName = 'Nồi chiên không dầu';
          } else if (/bếp|nấu|đun|canh|stove/i.test(part)) {
            device = 'stove';
            deviceName = 'Bếp đun';
          }

          const minMatch = part.match(/(\d+)\s*(?:p|phút|min)/i);
          if (minMatch) mins = parseInt(minMatch[1], 10);

          name = part.replace(/\(.*?\)/g, '').replace(/-\s*\d+.*$/g, '').trim();

          parsedDishes.push({
            name: name,
            minutes: mins,
            device: device,
            device_name: deviceName
          });

          newSteps.push({
            step_id: idx + 1,
            badge: `${deviceName}: ${name}`,
            action_verb: `Làm_nóng`,
            atomic_instruction: `Cho ${name} vào ${deviceName}, chỉnh ${mins} phút và bấm Start.`,
            ui_type: "pipeline_timer",
            device: device,
            device_name: deviceName,
            dish_name: name,
            duration_sec: mins * 60,
            dopamine_points: 5,
            hints: [`Chỉnh ${mins} phút trên ${deviceName} con nhé!`]
          });
        });

        // Step dọn bát đũa
        newSteps.push({
          step_id: newSteps.length + 1,
          badge: "Lấy bát đũa & Xới cơm",
          action_verb: "Lấy_bát",
          atomic_instruction: "Lấy bát đũa, thìa và xới cơm nóng ra bàn ăn trong lúc các món đang hâm nóng.",
          ui_type: "checkbox",
          is_milestone: false,
          requires_parent_check: false,
          duration_sec: 60,
          dopamine_points: 5,
          hints: ["Lấy đủ bát đũa và xới cơm nóng ra bàn nào!"]
        });

        // Step chụp ảnh minh chứng
        newSteps.push({
          step_id: newSteps.length + 1,
          badge: "Minh chứng mâm cơm tươm tất",
          action_verb: "Chụp_ảnh",
          atomic_instruction: "Khi chuông các món đã reo xong, dùng lót tay bê thức ăn ra bàn và chụp ảnh mâm cơm tươm tất gửi Mẹ!",
          ui_type: "photo_proof",
          is_milestone: true,
          requires_parent_check: false,
          duration_sec: 45,
          dopamine_points: 10,
          hints: ["Mâm cơm nóng hổi thơm ngon đã sẵn sàng, chụp ngay gửi Mẹ nào!"]
        });

        rt.flex_meal_config = { dishes: parsedDishes };
        rt.steps = newSteps;

        // Cập nhật trong lộ trình con nếu đang có
        if (Array.isArray(appState.childRoutineRoadmap)) {
          const targetInRoadmap = appState.childRoutineRoadmap.find(r => r && (r.id === routineId));
          if (targetInRoadmap) {
            targetInRoadmap.flex_meal_config = rt.flex_meal_config;
            targetInRoadmap.steps = rt.steps;
            if (typeof renderParentActiveRoadmapList === 'function') renderParentActiveRoadmapList();
            if (typeof window.renderChildRoutineRoadmapFromTasks === 'function') {
              window.renderChildRoutineRoadmapFromTasks(appState.childRoutineRoadmap);
            }
          }
        }

        saveRoutineCustomizations();
        const bus = window.miloBus || window.syncBus;
        if (bus && typeof bus.savePersistedState === 'function') {
          bus.savePersistedState(appState);
        }

        if (typeof showToast === 'function') {
          showToast("Đã Lưu & Giữ Thực Đơn", `Mẹ vừa cập nhật ${parsedDishes.length} món hâm nóng cho bữa cơm của Leo!`, "🍲");
        }
        renderParentRoutinesCatalog();
      }
    }


    function toggleRoutineDrawer(routineId, e) {
      if (e) e.stopPropagation();
      if (typeof playSfx === 'function') playSfx('tap');
      const drawer = document.getElementById(`drawer-${routineId}`);
      const chevron = document.getElementById(`chevron-${routineId}`);
      if (!drawer) return;
      if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      } else {
        drawer.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
      }
    }
    window.toggleRoutineDrawer = toggleRoutineDrawer;
    window.saveRoutineCustomizations = saveRoutineCustomizations;
    window.loadRoutineCustomizations = loadRoutineCustomizations;
    window.parentUpdateRoutineSlotTime = parentUpdateRoutineSlotTime;
    window.parentOpenFlexMealConfig = parentOpenFlexMealConfig;


    /* ============================================================
       MULTI-CHILD MANAGEMENT & PINPAD CONTROLLER
       ============================================================ */

    function renderParentProfileCards() {
      const container = document.getElementById('parent-profile-cards-list');
      if (!container) return;
      container.innerHTML = '';

      let children = appState.childrenList || [];
      if (!Array.isArray(children) || children.length === 0) {
        children = [
          { kid_id: 'kid_leo_01', name: 'Bé Leo', grade: 1, avatar: '🦁', stars: 450, pairing_code: '729-184' },
          { kid_id: 'kid_minh_02', name: 'Bé Minh', grade: 3, avatar: '🐯', stars: 320, pairing_code: '852-369' }
        ];
        appState.childrenList = children;
      }

      children.forEach(c => {
        const isActive = (c.kid_id === (appState.parentSelectedKidId || appState.activeChildId));
        const card = document.createElement('div');
        card.className = `p-3.5 rounded-2xl border-2 transition ${
          isActive 
            ? 'bg-gradient-to-br from-teal-50 to-emerald-50/70 border-teal-500 shadow-sm' 
            : 'bg-white border-slate-200 hover:border-slate-300'
        }`;

        card.innerHTML = `
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs text-2xl flex items-center justify-center shrink-0">
                ${c.avatar || '🦁'}
              </div>
              <div>
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h3 class="font-black text-sm text-slate-900">${c.name}</h3>
                  <span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-teal-100 text-teal-800">Lớp ${c.grade}</span>
                  ${isActive ? '<span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500 text-white animate-pulse">● Đang xem</span>' : ''}
                </div>
                <div class="flex items-center gap-2 mt-1 text-[11px] font-bold text-slate-500">
                  <span class="text-amber-600 font-extrabold">${c.stars || 0} ⭐</span>
                  <span>•</span>
                  <span class="text-slate-400">GDPT 2018</span>
                </div>
              </div>
            </div>

            <!-- PIN Badge -->
            <div class="text-right shrink-0">
              <span class="text-[9px] font-bold text-slate-400 block">MÃ GHÉP NỐI</span>
              <button onclick="showParentPinModal('${c.name}', '${c.pairing_code || '729-184'}')" class="font-mono font-black text-xs px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg hover:bg-amber-200 transition cursor-pointer">
                🔑 ${c.pairing_code || '729-184'}
              </button>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 pt-3 mt-2 border-t border-slate-200/60">
            ${
              isActive 
                ? '<button disabled class="flex-1 py-1.5 bg-teal-600 text-white rounded-xl text-xs font-black opacity-80 cursor-default">Đang xem trên Giám Sát</button>'
                : `<button onclick="parentSelectChild('${c.kid_id}')" class="flex-1 py-1.5 bg-white hover:bg-teal-50 border border-teal-500 text-teal-700 rounded-xl text-xs font-black transition active:scale-95 cursor-pointer">👁️ Chuyển Xem Bé Này</button>`
            }
            <button onclick="openSurveyModal()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer" title="Làm khảo sát ADHD riêng cho bé">
              📝 Khảo Sát
            </button>
            <button onclick="regenerateChildPin('${c.kid_id}')" class="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs transition cursor-pointer" title="Đổi mã PIN mới">
              🔄
            </button>
          </div>
        `;
        container.appendChild(card);
      });
    }

    let selectedNewGrade = 1;
    let selectedNewAvatar = '🦁';

    function openAddChildModal() {
      playSfx('tap');
      selectedNewGrade = 1;
      selectedNewAvatar = '🦁';
      const nameInput = document.getElementById('add-child-name');
      if (nameInput) nameInput.value = '';
      selectAddChildGrade(1);
      selectAddChildAvatar('🦁');
      const modal = document.getElementById('parent-add-child-modal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.style.display = 'flex';
      }
    }

    function closeAddChildModal() {
      playSfx('tap');
      const modal = document.getElementById('parent-add-child-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.style.display = 'none';
      }
    }

    function selectAddChildGrade(grade) {
      selectedNewGrade = grade;
      [1, 2, 3, 4, 5].forEach(g => {
        const btn = document.getElementById(`add-grade-${g}`);
        if (!btn) return;
        if (g === grade) {
          btn.className = "py-1.5 rounded-lg border font-bold text-center bg-teal-600 text-white border-teal-600 cursor-pointer";
        } else {
          btn.className = "py-1.5 rounded-lg border font-bold text-center bg-slate-50 text-slate-700 border-slate-200 cursor-pointer";
        }
      });
    }

    function selectAddChildAvatar(emoji) {
      selectedNewAvatar = emoji;
      document.querySelectorAll('#add-child-avatar-group .avatar-opt').forEach(el => {
        if (el.innerText.trim() === emoji) {
          el.className = "avatar-opt cursor-pointer p-1 rounded-lg bg-teal-100 ring-2 ring-teal-500";
        } else {
          el.className = "avatar-opt cursor-pointer p-1 rounded-lg";
        }
      });
    }

    async function submitCreateChild() {
      playSfx('bell');
      const nameInput = document.getElementById('add-child-name');
      const name = (nameInput && nameInput.value.trim()) || "Bé Yêu";

      try {
        const res = await fetch('/api/parent/children', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parent_id: 'parent_lan_01',
            name: name,
            grade: selectedNewGrade,
            avatar: selectedNewAvatar,
          })
        });

        if (res.ok) {
          const data = await res.json();
          closeAddChildModal();
          await fetchChildrenList();
          if (data.child && data.child.pairing_code) {
            showParentPinModal(data.child.name, data.child.pairing_code);
          }
          showToast("Đã Tạo Hồ Sơ Mới", `${name} (Lớp ${selectedNewGrade}) đã sẵn sàng!`, "🎉");
        }
      } catch (err) {
        console.error("Lỗi tạo con:", err);
      }
    }

    function showParentPinModal(childName, code) {
      playSfx('tap');
      const modal = document.getElementById('parent-pin-modal');
      const nameEl = document.getElementById('parent-pin-modal-name');
      const codeEl = document.getElementById('parent-pin-modal-code');
      if (nameEl) nameEl.innerText = `Mã Ghép Nối ${childName}`;
      if (codeEl) codeEl.innerText = code || "729-184";
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.style.display = 'flex';
      }
    }

    function closeParentPinModal() {
      playSfx('tap');
      const modal = document.getElementById('parent-pin-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.style.display = 'none';
      }
    }

    async function regenerateChildPin(kidId) {
      playSfx('tap');
      try {
        const res = await fetch(`/api/parent/children/${kidId}/pairing-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent_id: 'parent_lan_01' })
        });
        if (res.ok) {
          const data = await res.json();
          await fetchChildrenList();
          showToast("Mã PIN Mới", `Mã mới: ${data.pairing_code}`, "🔑");
        }
      } catch (e) {
        console.error("Lỗi đổi mã PIN:", e);
      }
    }

    function toggleParentCoachDrawer() {
      const drawer = document.getElementById('coach-drawer-content');
      const chevron = document.getElementById('coach-drawer-chevron');
      if (!drawer) return;
      if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        if (chevron) chevron.innerText = "▾";
      } else {
        drawer.classList.add('hidden');
        if (chevron) chevron.innerText = "▸";
      }
    }

    /* ---------------- Child Profile Sheet & Pinpad ---------------- */
    function openChildProfileSheet() {
      playSfx('tap');
      const child = appState.childDeviceProfile || appState.currentKidProfile || { name: 'Bé Leo', grade: 1, avatar: '🦁', stars: 450, pairing_code: '729-184' };
      const pinEl = document.getElementById('child-sheet-pin');
      if (pinEl) pinEl.innerText = child.pairing_code || "729-184";
      if (typeof updateChildProfileDisplay === 'function') updateChildProfileDisplay();
      const sheet = document.getElementById('child-profile-sheet');
      if (sheet) {
        sheet.classList.remove('hidden');
        sheet.classList.add('flex');
        sheet.style.display = 'flex';
      }
      const pinInput = document.getElementById('child-sheet-pin-input');
      if (pinInput) {
        pinInput.value = '';
        setTimeout(() => pinInput.focus(), 100);
      }
    }

    function quickFillSheetPin(code) {
      playSfx('tap');
      const input = document.getElementById('child-sheet-pin-input');
      if (input) {
        input.value = code;
        setTimeout(() => {
          submitChildSheetPin();
        }, 120);
      }
    }

    async function submitChildSheetPin() {
      const input = document.getElementById('child-sheet-pin-input');
      const rawVal = input ? input.value.trim() : '';
      const digits = rawVal.replace(/\D/g, '');
      if (digits.length !== 6) {
        showToast("Mã PIN Chưa Đủ", "Vui lòng nhập đủ 6 chữ số con nhé (VD: 852-369)!", "⚠️");
        if (input) input.focus();
        return;
      }

      playSfx('bell');
      const formattedCode = `${digits.slice(0, 3)}-${digits.slice(3, 6)}`;
      try {
        const res = await fetch('/api/child/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: formattedCode })
        });

        if (res.ok) {
          const data = await res.json();
          const matchedChild = data.child;
          closeChildProfileSheet();
          if (input) input.value = '';
          await loginChildDevice(matchedChild.kid_id);
          showToast("Đổi Bé Thành Công! 🚀", `Chào mừng ${matchedChild.avatar} ${matchedChild.name} (Lớp ${matchedChild.grade})!`, "🎉");
        } else {
          showToast("Mã Không Hợp Lệ", "Mã PIN không đúng hoặc đã hết hạn.", "❌");
          if (input) {
            input.value = '';
            input.focus();
          }
        }
      } catch (err) {
        showToast("Lỗi Kết Nối", "Không thể kiểm tra mã PIN.", "❌");
      }
    }

    function closeChildProfileSheet() {
      playSfx('tap');
      const sheet = document.getElementById('child-profile-sheet');
      if (sheet) {
        sheet.classList.add('hidden');
        sheet.classList.remove('flex');
        sheet.style.display = 'none';
      }
    }

    let pinInputBuffer = "";

    function openChildPinpadModal() {
      closeChildProfileSheet();
      playSfx('tap');
      pinInputBuffer = "";
      renderPinSlots();
      const modal = document.getElementById('child-pinpad-modal');
      if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
      }
    }

    // 1-Click Quick Switch dành cho bé và user kiểm thử
    function quickFillChildPin(digits) {
      playSfx('tap');
      pinInputBuffer = digits.replace(/\D/g, '').slice(0, 6);
      renderPinSlots();
      setTimeout(() => {
        submitChildPin();
      }, 150);
    }

    function closeChildPinpadModal() {
      playSfx('tap');
      const modal = document.getElementById('child-pinpad-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.style.display = 'none';
      }
    }

    function renderPinSlots() {
      for (let i = 0; i < 6; i++) {
        const slot = document.getElementById(`pin-slot-${i}`);
        if (slot) {
          if (i < pinInputBuffer.length) {
            slot.innerText = pinInputBuffer[i];
            slot.className = "w-9 h-11 rounded-xl bg-teal-900 border-2 border-teal-400 text-teal-200 font-mono font-black text-xl flex items-center justify-center shadow-inner animate-scale-up";
          } else {
            slot.innerText = "-";
            slot.className = "w-9 h-11 rounded-xl bg-slate-800 border-2 border-slate-700 text-white font-mono font-black text-xl flex items-center justify-center shadow-inner";
          }
        }
      }
    }

    function pressPinDigit(digit) {
      if (pinInputBuffer.length < 6) {
        playSfx('tap');
        pinInputBuffer += digit;
        renderPinSlots();
      }
    }

    function clearPinDigits() {
      playSfx('tap');
      pinInputBuffer = "";
      renderPinSlots();
    }

    function backspacePinDigit() {
      if (pinInputBuffer.length > 0) {
        playSfx('tap');
        pinInputBuffer = pinInputBuffer.slice(0, -1);
        renderPinSlots();
      }
    }

    async function submitChildPin() {
      if (pinInputBuffer.length !== 6) {
        showToast("Mã PIN Chưa Đủ", "Vui lòng nhập đủ 6 chữ số con nhé!", "⚠️");
        return;
      }
      playSfx('bell');
      try {
        const formattedCode = `${pinInputBuffer.slice(0, 3)}-${pinInputBuffer.slice(3, 6)}`;
        const res = await fetch('/api/child/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: formattedCode })
        });

        if (res.ok) {
          const data = await res.json();
          const matchedChild = data.child;
          closeChildPinpadModal();
          await loginChildDevice(matchedChild.kid_id);
          showToast("Ghép Nối Thành Công! 🚀", `Chào mừng ${matchedChild.avatar} ${matchedChild.name} (Lớp ${matchedChild.grade})!`, "🦁");
        } else {
          showToast("Mã Không Hợp Lệ", "Mã PIN không đúng hoặc đã hết hạn.", "❌");
          clearPinDigits();
        }
      } catch (err) {
        showToast("Lỗi Kết Nối", "Không thể kiểm tra mã PIN.", "❌");
      }
    }


// Global Window Exports for Multi-Child & Profile Controls
if (typeof window !== 'undefined') {
  window.parentSwitchTab = parentSwitchTab;
  window.parentFilterGrade = parentFilterGrade;
  window.renderParentCatalogList = renderParentCatalogList;
  window.renderParentProfileCards = renderParentProfileCards;
  window.openAddChildModal = openAddChildModal;
  window.closeAddChildModal = closeAddChildModal;
  window.selectAddChildGrade = selectAddChildGrade;
  window.selectAddChildAvatar = selectAddChildAvatar;
  window.submitCreateChild = submitCreateChild;
  window.showParentPinModal = showParentPinModal;
  window.closeParentPinModal = closeParentPinModal;
  window.regenerateChildPin = regenerateChildPin;
  window.toggleParentCoachDrawer = toggleParentCoachDrawer;
  window.openChildProfileSheet = openChildProfileSheet;
  window.closeChildProfileSheet = closeChildProfileSheet;
  window.openChildPinpadModal = openChildPinpadModal;
  window.closeChildPinpadModal = closeChildPinpadModal;
  window.pressPinDigit = pressPinDigit;
  window.clearPinDigits = clearPinDigits;
  window.backspacePinDigit = backspacePinDigit;
  window.submitChildPin = submitChildPin;
  window.submitChildSheetPin = submitChildSheetPin;
  window.quickFillSheetPin = quickFillSheetPin;
  window.quickFillChildPin = quickFillChildPin;

  // Lắng nghe bàn phím vật lý máy tính khi mở modal PIN máy con
  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('child-pinpad-modal');
    if (!modal || modal.classList.contains('hidden') || modal.style.display === 'none') return;
    
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      pressPinDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      backspacePinDigit();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submitChildPin();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeChildPinpadModal();
    }
  });
}


// Auto-initialize profile cards on script load
setTimeout(() => {
  if (typeof renderParentProfileCards === 'function') renderParentProfileCards();
  if (typeof updateChildProfileDisplay === 'function') updateChildProfileDisplay();
}, 150);
