'use client';

import { useState, useEffect } from 'react';
import TimeMachineSelector from '@/components/TimeMachineSelector';
import { Quarter } from '@/lib/quarters';

interface Props {
  quarters: Quarter[];
  snapshotDate: string | null;
  onSnapshotChange: (date: string | null) => void;
  children?: React.ReactNode;
}

export default function Header({ quarters, snapshotDate, onSnapshotChange, children }: Props) {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', { hour12: false }));
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const d = String(now.getDate()).padStart(2, '0');
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const yr = now.getFullYear();
      setDate(`${days[now.getDay()]}, ${d}/${mo}/${yr}`);
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const isSnapshot = snapshotDate !== null;

  return (
    <header className={`header${isSnapshot ? ' snapshot-mode' : ''}`}>
      {/* Column 1 (3fr): Branding + Optional Banner */}
      <div className="header-brand" style={{ position: 'relative' }}>
        <div>
          <div className="header-logo">HELLONASDAQ</div>
          <div className="header-tagline">Personal Portfolio Terminal</div>
        </div>
        {/* If banner exists, it can float here or be handled separately */}
        <div style={{ marginLeft: '40px' }}>{children}</div>
      </div>

      {/* Column 2 (2fr): Clock (Centered) and Selector (Right) */}
      <div className="header-right-area">
        <div style={{ flex: 1 }}></div> {/* Spacer to push clock to center */}
        
        <div className="header-clock" style={{ fontSize: '0.77rem', fontFamily: 'var(--font-mono)', display: 'flex', gap: '12px', whiteSpace: 'nowrap' }}>
          <span style={{ opacity: 0.6 }}>{date}</span>
          <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{time}</span>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <TimeMachineSelector 
            quarters={quarters}
            selected={snapshotDate}
            onChange={onSnapshotChange}
          />
        </div>
      </div>
    </header>
  );
}
