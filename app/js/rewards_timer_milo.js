/* ============================================================
   MODULE: REWARDS, VISUAL TIMER & MILO RSD RESCUE
   ============================================================ */
    /* ============================================================
       H. NỔ SAO DOPAMINE < 300MS & CHUYỂN BƯỚC / ĂN MỪNG
       ============================================================ */
    function completeChildStep() {
      // 1. Phản hồi Dopamine tức thì < 300ms
      playSfx('star');
      spawnStars();
      const earned = 40;
      const newStars = appState.stars + earned;
      updateStarsEverywhere(newStars);

      const totalSteps = appState.activeTask ? appState.activeTask.steps.length : 3;
      const isFinalStep = appState.currentStepIndex >= totalSteps - 1;

      // 1.5. Dynamic Adaptive Cognitive Profile Updating
      const durationSec = window._stepStartTs ? Math.max(1, (Date.now() - window._stepStartTs) / 1000) : 45;
      const tMeta = window._stepTelemetry || {};
      const telemetryPayload = {
        task_initiation_latency_sec: tMeta.task_initiation_latency_sec !== null && tMeta.task_initiation_latency_sec !== undefined ? tMeta.task_initiation_latency_sec : 4.0,
        mistakes_count: tMeta.mistakes_count || 0,
        hints_used: tMeta.hints_used || 0,
        actual_duration_sec: durationSec,
        timer_allocated_sec: (appState.activeTask && appState.activeTask.steps && appState.activeTask.steps[appState.currentStepIndex] && appState.activeTask.steps[appState.currentStepIndex].duration_sec) || 120,
        focus_duration_min: Math.min(25, durationSec / 60 + 5),
        post_error_freeze_sec: tMeta.post_error_freeze_sec || 0,
        milo_rescues_count: appState.pauseCount || 0,
        abandoned_count: 0,
        task_id: appState.activeTask ? appState.activeTask.id : 'unknown',
        step_id: appState.currentStepIndex
      };

      if (typeof adaptiveUpdateCognitiveProfile === 'function') {
        const updatedProf = adaptiveUpdateCognitiveProfile(appState.cognitiveProfile, telemetryPayload);
        appState.cognitiveProfile = updatedProf;
      }

      // Broadcast STEP_COMPLETED & STARS_SYNC & TELEMETRY
      const targetBus = window.miloBus || window.syncBus;
      if (targetBus && typeof targetBus.broadcast === 'function') {
        targetBus.broadcast('STEP_COMPLETED', {
          taskId: appState.activeTask ? appState.activeTask.id : 'unknown',
          stepIndex: appState.currentStepIndex,
          totalSteps: totalSteps,
          starsEarned: earned,
          totalStarsNow: newStars,
          isTaskComplete: isFinalStep,
          telemetry: telemetryPayload,
          cognitive_profile: appState.cognitiveProfile
        });
        targetBus.broadcast('STARS_SYNC', {
          totalStars: newStars,
          delta: earned,
          reason: 'step_reward'
        });
        targetBus.broadcast('STEP_TELEMETRY_UPDATE', {
          kid_id: appState.childDeviceKidId || 'kid_leo_01',
          telemetry: telemetryPayload,
          cognitive_profile: appState.cognitiveProfile
        });
      }

      // Asynchronous API call to persist in backend database
      if (typeof fetch !== 'undefined') {
        const kidId = appState.childDeviceKidId || 'kid_leo_01';
        fetch(`/api/child/${kidId}/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(telemetryPayload)
        }).catch(() => {});
      }

      if (!isFinalStep) {
        // Chuyển vi bước tiếp theo: Tuyệt đối không phát audio giọng nói chen giữa các microtask để tránh quá tải giác quan / đứt mạch tập trung
        appState.currentStepIndex++;
        if (window.miloBus) window.miloBus.savePersistedState(appState);
        setTimeout(() => { renderChildWorkspaceStep(); }, 250);
      } else {
        // Hoàn thành toàn bộ hòn đảo hiện tại - Phát audio hoan hô chúc mừng hòn đảo thành công!
        stopStepTimer();
        playSfx('success');
        if (window.miloVoice) window.miloVoice.playRewardIsland();
        if (window.miloBus) {
          window.miloBus.broadcast('ISLAND_COMPLETED', {
            taskId: appState.activeTask ? appState.activeTask.id : 'unknown',
            islandTitle: appState.activeTask ? appState.activeTask.title : 'Đảo Nhiệm Vụ',
            totalStars: newStars,
            nextIslandIndex: appState.currentRoadmapIndex + 1
          });
          window.miloBus.savePersistedState(appState);
        }
        setTimeout(() => { showCelebration(); }, 300);
      }
    }

    function spawnStars() {
      const container = document.getElementById('child-screen-workspace');
      for (let i = 0; i < 7; i++) {
        const star = document.createElement('div');
        star.className = 'star-burst text-2xl';
        star.innerText = ['⭐', '✨', '💫', '🌟'][Math.floor(Math.random() * 4)];
        star.style.left = (60 + i * 38) + 'px';
        star.style.bottom = '85px';
        container.appendChild(star);
        setTimeout(() => star.remove(), 700);
      }
    }

    function showCelebration() {
      const modal = document.getElementById('child-modal-celebration');
      modal.classList.remove('hidden');
      modal.classList.add('flex');

      const task = appState.activeTask;
      document.getElementById('child-celeb-title').innerText = `${task.title} thành công! 🚀`;
      document.getElementById('child-celeb-desc').innerHTML = `"Milo thấy Leo rất kiên trì hoàn thành xuất sắc tất cả ${task.steps.length} vi nhiệm vụ mà không bỏ cuộc giữa chừng!"`;
      document.getElementById('child-celeb-reward-val').innerText = `+${task.reward} Sao`;

      // Cập nhật Telemetry bên máy Mẹ
      document.getElementById('telemetry-status-badge').innerHTML = "🎉 Vừa hoàn thành!";
      document.getElementById('telemetry-status-badge').className = "inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold";
      document.getElementById('telemetry-progress-text').innerText = `${task.steps.length}/${task.steps.length} bước xong 🎉`;
      
      showToast("Đồng bộ máy Mẹ", `Leo vừa hoàn thành: ${task.title}`, "🎉");
    }

    function proceedToNextRoadmapIsland() {
      playSfx('tap');
      const modal = document.getElementById('child-modal-celebration');
      if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
      }

      const isRoutine = !!(appState.activeTaskIsRoutine || (appState.activeTask && (appState.activeTask.cat === 'chore' || appState.activeTask.isRoutine || (typeof routineDatabase !== 'undefined' && routineDatabase[appState.activeTask.id]))));

      if (isRoutine) {
        // ĐÂY LÀ NHIỆM VỤ SINH HOẠT THÓI QUEN
        if (appState.activeTask && appState.activeTask.id) {
          if (!appState.completedRoutineIds) appState.completedRoutineIds = new Set();
          appState.completedRoutineIds.add(appState.activeTask.id);
        }
        appState.selectedActiveRoutineId = null;

        const routines = appState.childRoutineRoadmap || [];
        const completed = appState.completedRoutineIds || new Set();
        const allDone = routines.length > 0 && routines.every(r => {
          const id = typeof r === 'string' ? r : (r ? r.id : null);
          return id && completed.has(id);
        });

        if (allDone) {
          // ĐÃ HOÀN THÀNH TOÀN BỘ CÁC NỀ NẾP SINH HOẠT TRONG NGÀY
          openRoutineTreasureCeremony();
        } else {
          // Vẫn còn nề nếp khác: Quay về Đảo Thói Quen, hòn đảo vừa làm được tick xanh
          childSwitchScreen('home');
          if (typeof window.childSwitchIslandMode === 'function') {
            window.childSwitchIslandMode('routine');
          }
        }
        if (window.miloBus) window.miloBus.savePersistedState(appState);
        return;
      }

      // ĐÂY LÀ NHIỆM VỤ HỌC TẬP GDPT 2018
      const totalStudyTasks = Array.isArray(appState.childRoadmap) ? appState.childRoadmap.length : 0;
      if (appState.currentRoadmapIndex < totalStudyTasks - 1) {
        appState.currentRoadmapIndex++;
        childSwitchScreen('home');
        if (typeof window.childSwitchIslandMode === 'function') {
          window.childSwitchIslandMode('study');
        }
      } else {
        // ĐÃ HOÀN THÀNH TẤT CẢ CÁC BÀI TẬP GDPT -> MỞ RƯƠNG BÁU HOÀNG KIM!
        appState.currentRoadmapIndex = totalStudyTasks;
        openTreasureCeremony();
      }
      if (window.miloBus) window.miloBus.savePersistedState(appState);
    }

    function openTreasureCeremony() {
      playSfx('success');
      const ceremony = document.getElementById('child-modal-treasure-ceremony');
      if (ceremony) {
        ceremony.classList.remove('hidden');
        ceremony.classList.add('flex');
      }
      const newStars = appState.stars + 250;
      updateStarsEverywhere(newStars);
      if (window.miloBus) {
        window.miloBus.broadcast('TREASURE_UNLOCKED', {
          totalStarsEarned: newStars,
          unlockedRewards: ["Huy hiệu Hiệp Sĩ Tập Trung", "Mở khóa Đổi Vé Vàng"]
        });
        window.miloBus.broadcast('STARS_SYNC', {
          totalStars: newStars,
          delta: 250,
          reason: 'island_bonus'
        });
        window.miloBus.savePersistedState(appState);
      }
      if (appState.role === 'parent' || appState.role === 'dual') {
        showToast("RƯƠNG BÁU HOÀNG KIM!", "Leo đã nhận thêm +250 ⭐ và mở khóa Trạm Vé Vàng!", "👑");
      }
    }

    function openRoutineTreasureCeremony() {
      playSfx('success');
      const ceremony = document.getElementById('child-modal-treasure-ceremony');
      if (ceremony) {
        const titleEl = ceremony.querySelector('h2, .text-xl, .font-black');
        if (titleEl) titleEl.innerText = "🏆 RƯƠNG HOÀNG KIM NỀ NẾP!";
        const descEl = ceremony.querySelector('p');
        if (descEl) descEl.innerText = "Leo đã tự giác hoàn thành xuất sắc tất cả các thói quen nề nếp trong ngày! Nhận thưởng +100 ⭐!";
        ceremony.classList.remove('hidden');
        ceremony.classList.add('flex');
      }
      const newStars = appState.stars + 100;
      updateStarsEverywhere(newStars);
      if (window.miloBus) {
        window.miloBus.broadcast('ROUTINE_TREASURE_UNLOCKED', {
          totalStarsEarned: newStars,
          unlockedRewards: ["Huy hiệu Hiệp Sĩ Nề Nếp Tự Lập", "+100 ⭐"]
        });
        window.miloBus.broadcast('STARS_SYNC', {
          totalStars: newStars,
          delta: 100,
          reason: 'routine_bonus'
        });
        window.miloBus.savePersistedState(appState);
      }
      if (typeof renderChildRoutineRoadmapFromTasks === 'function') {
        renderChildRoutineRoadmapFromTasks(appState.childRoutineRoadmap);
      }
    }

    function openRedeemFromTreasure() {
      playSfx('tap');
      exitTreasureModal();
      childSwitchScreen('rewards');
    }

    function exitTreasureModal() {
      const ceremony = document.getElementById('child-modal-treasure-ceremony');
      if (ceremony) {
        ceremony.classList.add('hidden');
        ceremony.classList.remove('flex');
      }
      childSwitchScreen('home');
      if (appState.activeTaskIsRoutine) {
        if (typeof window.childSwitchIslandMode === 'function') {
          window.childSwitchIslandMode('routine');
        }
      } else {
        if (typeof window.childSwitchIslandMode === 'function') {
          window.childSwitchIslandMode('study');
        }
      }
    }


    /* ============================================================
       I. ROBOT MILO HẠ NHIỆT RSD & BÀI TẬP THỞ BỤNG 4-4-4
       ============================================================ */
    function toggleSoftPause(show) {
      playSfx('breathe');
      const modal = document.getElementById('child-modal-soft-pause');
      const ring = document.getElementById('child-ring-timer');
      
      if (show) {
        isTimerPaused = true;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        ring.classList.add('ring-timer-paused');
        updateTimerUI();

        // Kích hoạt chu kỳ thở bụng 4-4-4
        startBoxBreathing();

        appState.pauseCount++;
        const pCountEl = document.getElementById('telemetry-pause-count');
        if (pCountEl) pCountEl.innerHTML = `${appState.pauseCount} lần <span class="text-emerald-600 font-semibold">(Biết tự điều tiết CBT)</span>`;
        const badgeEl = document.getElementById('telemetry-status-badge');
        if (badgeEl) badgeEl.innerHTML = "🔋 Tự giác Pause (CBT)";

        if (window.miloBus) {
          window.miloBus.broadcast('MILO_RESCUE_TRIGGER', {
            reason: 'user_clicked_rescue',
            stepId: appState.currentStepIndex + 1,
            taskId: appState.activeTask ? appState.activeTask.id : 'unknown',
            pauseCount: appState.pauseCount
          });
          window.miloBus.savePersistedState(appState);
        }
      } else {
        isTimerPaused = false;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        ring.classList.remove('ring-timer-paused');
        updateTimerUI();
        stopBoxBreathing();
      }
    }

    function startBoxBreathing() {
      stopBoxBreathing();
      breathingStage = 0;
      breathingSecondsLeft = 4;
      breathingCycleCount = 1;
      updateBreathingUI();

      breathingInterval = setInterval(() => {
        breathingSecondsLeft--;
        if (breathingSecondsLeft <= 0) {
          breathingSecondsLeft = 4;
          breathingStage = (breathingStage + 1) % 4;
          if (breathingStage === 0) {
            breathingCycleCount++;
          }
          playSfx('breathe');
        }
        updateBreathingUI();
      }, 1000);
    }

    function stopBoxBreathing() {
      if (breathingInterval) {
        clearInterval(breathingInterval);
        breathingInterval = null;
      }
    }

    function updateBreathingUI() {
      const label = document.getElementById('breathing-phase-label');
      const counter = document.getElementById('breathing-cycle-counter');
      const num = document.getElementById('breathing-seconds-num');
      const orb = document.getElementById('breathing-orb');
      const sub = document.getElementById('breathing-sub-instruction');

      if (!label || !num || !orb) return;

      counter.innerText = `Nhịp ${breathingCycleCount} / 3`;
      num.innerText = breathingSecondsLeft;

      // Phát âm thanh hướng dẫn nhịp thở ở giây đầu tiên của mỗi pha
      if (breathingSecondsLeft === 4 && window.miloVoice) {
        if (breathingStage === 0) window.miloVoice.play('breathe_phase1_inhale');
        else if (breathingStage === 1) window.miloVoice.play('breathe_phase2_hold');
        else if (breathingStage === 2) window.miloVoice.play('breathe_phase3_exhale');
        else if (breathingStage === 3) window.miloVoice.play('breathe_phase4_relax');
      }

      if (breathingStage === 0) {
        label.innerText = `🫁 1. Hít vào từ từ bằng mũi (${breathingSecondsLeft}s)`;
        label.className = "text-xs font-black text-sky-900 bg-sky-200/80 px-2.5 py-0.5 rounded-full";
        sub.innerText = "Hít không khí mát lành vào căng tròn bụng";
        orb.className = "w-20 h-20 rounded-full bg-sky-400 border-2 border-sky-500 flex items-center justify-center text-white font-black text-sm shadow-lg transition-all duration-1000 scale-125";
      } else if (breathingStage === 1) {
        label.innerText = `⏸️ 2. Giữ hơi thở êm dịu (${breathingSecondsLeft}s)`;
        label.className = "text-xs font-black text-teal-900 bg-teal-200/80 px-2.5 py-0.5 rounded-full";
        sub.innerText = "Giữ hơi nhẹ nhàng • Cảm nhận sự bình tĩnh";
        orb.className = "w-20 h-20 rounded-full bg-teal-300 border-2 border-teal-400 flex items-center justify-center text-teal-950 font-black text-sm shadow-md transition-all duration-1000 scale-125";
      } else if (breathingStage === 2) {
        label.innerText = `💨 3. Thở ra từ từ bằng miệng (${breathingSecondsLeft}s)`;
        label.className = "text-xs font-black text-indigo-900 bg-indigo-200/80 px-2.5 py-0.5 rounded-full";
        sub.innerText = "Thổi nhẹ như thổi nguội một bát súp ấm";
        orb.className = "w-20 h-20 rounded-full bg-sky-200 border-2 border-sky-300 flex items-center justify-center text-sky-900 font-black text-sm shadow-inner transition-all duration-1000 scale-90";
      } else {
        label.innerText = `🌿 4. Thả lỏng toàn thân (${breathingSecondsLeft}s)`;
        label.className = "text-xs font-black text-emerald-900 bg-emerald-200/80 px-2.5 py-0.5 rounded-full";
        sub.innerText = "Thả lỏng hai vai • Sẵn sàng đón chào năng lượng mới";
        orb.className = "w-20 h-20 rounded-full bg-emerald-200 border-2 border-emerald-300 flex items-center justify-center text-emerald-950 font-black text-sm shadow-inner transition-all duration-1000 scale-95";
      }
    }

    function useMiloHint() {
      playSfx('star');
      toggleSoftPause(false);
      const wrong = document.getElementById('math-wrong-op');
      if (wrong) {
        wrong.classList.add('opacity-20', 'pointer-events-none');
      }
      showToast("Milo hỗ trợ", "Đã làm mờ phép tính gây nhiễu giúp con!", "💡");
    }


    /* ============================================================
       J. TRẠM ĐỔI VÉ VÀNG (REWARD CENTER) & ĐỒNG BỘ MÁY MẸ
       ============================================================ */
    function childRedeemTicket(name, stars) {
      playSfx('tap');
      if (appState.stars < stars) {
        showToast("Chưa Đủ Sao", `Bạn cần ${stars} ⭐ để đổi món quà này. Cùng làm thêm nhiệm vụ nhé!`, "⭐");
        return;
      }
      playSfx('bell');
      const newStars = appState.stars - stars;
      updateStarsEverywhere(newStars);
      const btn = document.getElementById('btn-redeem-ticket');
      if (btn) {
        btn.innerText = "⏳ ĐÃ GỬI BỐ MẸ!";
        btn.disabled = true;
      }

      const ticketPayload = {
        ticketId: 'ticket_' + Date.now(),
        title: name,
        cost: stars,
        remainingStars: newStars
      };
      appState.pendingTicket = ticketPayload;

      // Broadcast TICKET_REDEEM_REQUEST & STARS_SYNC
      if (window.miloBus) {
        window.miloBus.broadcast('TICKET_REDEEM_REQUEST', ticketPayload);
        window.miloBus.broadcast('STARS_SYNC', {
          totalStars: newStars,
          delta: -stars,
          reason: 'ticket_deduct'
        });
        window.miloBus.savePersistedState(appState);
      }

      // Kích hoạt banner bên máy Mẹ Realtime (nếu ở single-tab dual mode)
      const banner = document.getElementById('parent-golden-ticket-banner');
      const doneBanner = document.getElementById('parent-golden-ticket-done');
      const dot = document.getElementById('p-reward-dot');
      const desc = document.getElementById('parent-ticket-desc');
      if (banner) banner.classList.remove('hidden');
      if (doneBanner) doneBanner.classList.add('hidden');
      if (dot) dot.classList.remove('hidden');
      if (desc) desc.innerText = `🎉 Leo vừa dùng ${stars} ⭐ để đổi [Vé Vàng: ${name}]!`;

      showToast("Vé Vàng Đã Gửi", `Yêu cầu đổi [${name}] đã gửi sang máy mẹ Lan để phê duyệt!`, "🎟️");
      if (window.miloVoice) window.miloVoice.playRewardTicket();
    }

    function childRedeemCustomTicket() {
      const inp = document.getElementById('custom-child-ticket-input');
      const val = inp.value.trim();
      if (!val) {
        alert("Vui lòng nhập điều ước Vé Vàng của bạn!");
        return;
      }
      childRedeemTicket(val, 200);
      inp.value = "";
    }

// Window exports
window.completeChildStep = completeChildStep;
window.spawnStars = spawnStars;
window.showCelebration = showCelebration;
window.proceedToNextRoadmapIsland = proceedToNextRoadmapIsland;
window.openTreasureCeremony = openTreasureCeremony;
window.openRedeemFromTreasure = openRedeemFromTreasure;
window.exitTreasureModal = exitTreasureModal;
window.toggleSoftPause = toggleSoftPause;
window.startBoxBreathing = startBoxBreathing;
window.stopBoxBreathing = stopBoxBreathing;
window.updateBreathingUI = updateBreathingUI;
window.useMiloHint = useMiloHint;
window.childRedeemTicket = childRedeemTicket;
window.childRedeemCustomTicket = childRedeemCustomTicket;


/* ============================================================
   K. BỘ ĐẾM THỜI GIAN LƠ ĐÃNG (INACTIVITY IDLE WATCHER 25S / 50S)
   Tự động nhắc nhở không phán xét khi trẻ ADHD mất tập trung
   ============================================================ */
let miloIdleSeconds = 0;
let miloIdleInterval = null;

function resetMiloIdle() {
  miloIdleSeconds = 0;
}

function initInactivityWatcher() {
  if (typeof window === 'undefined') return;

  const events = ['mousemove', 'mousedown', 'pointerdown', 'keydown', 'touchstart'];
  events.forEach(evt => {
    window.addEventListener(evt, resetMiloIdle, { passive: true });
  });

  if (miloIdleInterval) clearInterval(miloIdleInterval);
  miloIdleInterval = setInterval(() => {
    // Chỉ đếm khi đang ở màn hình làm bài workspace và timer không pause
    const ws = document.getElementById('child-screen-workspace');
    const isWorkspaceActive = ws && !ws.classList.contains('hidden');
    const isPaused = typeof isTimerPaused !== 'undefined' ? isTimerPaused : false;

    if (!isWorkspaceActive || isPaused) {
      miloIdleSeconds = 0;
      return;
    }

    miloIdleSeconds++;

    if (miloIdleSeconds === 25) {
      if (window.miloVoice) window.miloVoice.playIdleNudge();
    } else if (miloIdleSeconds === 50) {
      if (window.miloVoice) window.miloVoice.playIdleRescue();
    }
  }, 1000);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInactivityWatcher);
  } else {
    initInactivityWatcher();
  }
}
