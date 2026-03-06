import React, { useEffect, useRef } from 'react';
import './InlineInput.css';

const InlineInput = ({ 
  value, 
  onChange, 
  onSubmit, 
  onCancel, 
  placeholder = '', 
  autoFocus = false 
}) => {
  const inputRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (formRef.current && !formRef.current.contains(event.target)) {
        if (onCancel) onCancel();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onCancel]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit && value.trim()) {
      onSubmit(value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (onCancel) onCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (onSubmit && value.trim()) {
        onSubmit(value);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="inline-input-form" ref={formRef}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="inline-input"
        autoFocus={autoFocus}
      />
      <button type="submit" className="inline-input-submit" aria-label="Save">
        ↵
      </button>
    </form>
  );
};

export default InlineInput;
