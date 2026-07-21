import { useState, useRef, useEffect } from 'react';

export default function GlassSelect({ 
  value, 
  onChange, 
  options, 
  placeholder = "Select...", 
  disabled = false, 
  error = false 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close the dropdown if the user clicks outside of it
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Find the label for the currently selected value
  const selectedOption = options.find(o => (o.value ?? o) === value);
  const displayLabel = selectedOption ? (selectedOption.label ?? selectedOption.value ?? selectedOption) : placeholder;

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          padding: '10px 14px',
          background: error ? 'rgba(220,60,40,0.08)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${error ? 'rgba(255,90,69,0.3)' : isOpen ? 'rgba(99,140,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8,
          color: value ? '#d0dcf0' : 'rgba(140,165,215,0.5)',
          fontSize: 13,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s ease',
          fontFamily: 'Space Grotesk, sans-serif'
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayLabel}
        </span>
        <span style={{ 
          fontSize: 10, marginLeft: 8, color: 'rgba(140,165,215,0.5)',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
          transition: 'transform 0.2s ease' 
        }}>
          ▼
        </span>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
          background: 'rgba(10,14,24,0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(99,140,255,0.2)',
          borderRadius: 8,
          maxHeight: 220, overflowY: 'auto',
          zIndex: 999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column', padding: 4
        }}>
          {options.map((opt, idx) => {
            const optVal = opt.value ?? opt;
            const optLabel = opt.label ?? opt;
            const isDisabled = opt.disabled;
            const isSelected = optVal === value;

            return (
              <div
                key={idx}
                onClick={() => {
                  if (isDisabled) return;
                  onChange(optVal);
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  color: isDisabled ? 'rgba(140,165,215,0.3)' : isSelected ? '#a8c2ff' : '#d0dcf0',
                  background: isSelected ? 'rgba(99,140,255,0.15)' : 'transparent',
                  transition: 'background 0.1s ease',
                  fontFamily: 'Space Grotesk, sans-serif'
                }}
                onMouseEnter={e => { if(!isDisabled && !isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if(!isDisabled && !isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                {optLabel}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}