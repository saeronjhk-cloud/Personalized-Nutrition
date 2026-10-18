/** 재방문 홈 «💊 오늘 영양제» — 판정·문구는 domain/supplement/daily_check.ts 한 곳 */
import { useEffect, useMemo, useState } from "react";
import { loadSurveyHistory } from "../../lib/surveyHistoryRemote";
import { DAILY_TEXT, dailyItems, dayView, kstDate, toggle, type DailyItem, type DailyStore } from "../../domain/supplement/daily_check";
import { loadDaily, saveDaily, loadReminderPref, saveReminderPref, type ReminderPref } from "../../lib/suppDailyStore";
import { disableReminder, enableReminder, isReminderSupported } from "../../lib/reminder";

const HOURS: { h: 8 | 12 | 20; label: string }[] = [{ h: 8, label: "아침 8시" }, { h: 12, label: "점심 12시" }, { h: 20, label: "저녁 8시" }];

export default function SuppDaily() {
  const today = kstDate(new Date());
  const [items, setItems] = useState<DailyItem[] | null>(null);
  const [store, setStore] = useState<DailyStore>(() => loadDaily(today));
  const [pref, setPref] = useState<ReminderPref>(() => loadReminderPref());
  const [note, setNote] = useState<string | null>(null);
  const canRemind = isReminderSupported();

  useEffect(() => {
    let alive = true;
    loadSurveyHistory().then((h) => { if (alive) setItems(dailyItems(h[0]?.answers ?? null)); }).catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, []);

  const view = useMemo(() => dayView(store, today, items ?? []), [store, today, items]);
  if (!items || items.length === 0) return null;

  const onTap = (id: string) => { const next = toggle(store, today, id); setStore(next); saveDaily(next); };
  const setReminder = async (p: ReminderPref) => {
    setNote(null);
    if (p.on) {
      const ok = await enableReminder(p.hour);
      if (!ok) { setNote("알림 권한이 꺼져 있어요. 휴대폰 설정에서 알림을 허용해 주세요."); p = { ...p, on: false }; }
    } else await disableReminder();
    setPref(p); saveReminderPref(p);
  };

  return (
    <div className="returning-home__supp" data-testid="supp-daily">
      <div className="returning-home__supp-head">
        <span>{DAILY_TEXT.title}</span>
        {view.streakText && <span className="returning-home__supp-streak">{view.streakText}</span>}
      </div>
      <div className="returning-home__supp-chips">
        {items.map((i) => {
          const on = view.checked.includes(i.id);
          return (
            <button key={i.id} type="button" className={`returning-home__supp-chip${on ? " is-done" : ""}`} aria-pressed={on} onClick={() => onTap(i.id)}>
              {on ? "✓ " : ""}{i.label}
            </button>
          );
        })}
      </div>
      {view.doneText && <p className="returning-home__supp-done">{view.doneText}</p>}
      {canRemind && (
        <div className="returning-home__supp-remind" data-testid="supp-reminder">
          <label>
            <input type="checkbox" checked={pref.on} onChange={(e) => setReminder({ ...pref, on: e.target.checked })} /> 매일 알림
          </label>
          {pref.on && HOURS.map((o) => (
            <button key={o.h} type="button" className={`returning-home__supp-hour${pref.hour === o.h ? " is-on" : ""}`} onClick={() => setReminder({ on: true, hour: o.h })}>{o.label}</button>
          ))}
          {note && <p className="returning-home__supp-note">{note}</p>}
        </div>
      )}
    </div>
  );
}
