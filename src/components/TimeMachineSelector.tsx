'use client';

import { useState, useRef, useEffect } from 'react';
import { Quarter } from '@/lib/quarters';

interface Props {
  quarters: Quarter[];
  selected: string | null; // null = LIVE
  onChange: (endDate: string | null) => void;
}

export default function TimeMachineSelector({ quarters, selected, onChange }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Calculate current quarter label for the LIVE state
  const now = new Date();
  const currentQ = Math.ceil((now.getMonth() + 1) / 3);
  const currentYear = now.getFullYear();
  const liveLabel = `Q${currentQ} ${currentYear}`;

  const selectedQuarter = quarters.find(q => q.endDate === selected);
  const currentLabel = selected ? selectedQuarter?.label : liveLabel;

  return (
    <div className="custom-dropdown" ref={containerRef}>
      <span className="dropdown-label">Quarter</span>
      <button 
        className={`dropdown-trigger ${selected ? 'is-snapshot' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!selected && <span className="status-dot" />}
          <span>{selected ? `◷ ${currentLabel}` : currentLabel}</span>
        </div>
        <span style={{ fontSize: '0.6rem', opacity: 0.5, marginLeft: 'auto' }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          <div 
            className={`dropdown-item ${!selected ? 'active' : ''}`}
            onClick={() => { onChange(null); setIsOpen(false); }}
          >
            <span className="status-dot" style={{ marginRight: '8px' }} /> {liveLabel}
          </div>
          {[...quarters].reverse().map(q => (
            <div 
              key={q.endDate} 
              className={`dropdown-item ${selected === q.endDate ? 'active' : ''}`}
              onClick={() => { onChange(q.endDate); setIsOpen(false); }}
            >
              ◷ {q.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
