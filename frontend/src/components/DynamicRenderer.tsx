import React, { useState } from 'react';

export type ResponseType = 'text' | 'html' | 'weather' | 'tasks';

interface DynamicRendererProps {
  type: ResponseType;
  content: string; // Text or HTML string
}

export const DynamicRenderer: React.FC<DynamicRendererProps> = ({ type, content }) => {
  // Local state for the interactive tasks checklist
  const [tasks, setTasks] = useState([
    { id: 1, text: 'Review project specifications', done: true },
    { id: 2, text: 'Design Picture-in-Picture overlay', done: false },
    { id: 3, text: 'Integrate Web Speech API', done: false },
    { id: 4, text: 'Add liquid glass fluid card styling', done: false },
  ]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => task.id === id ? { ...task, done: !task.done } : task));
  };

  switch (type) {
    case 'weather':
      return (
        <div className="widget-weather" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#f8fafc' }}>San Francisco</h3>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>Partly Cloudy</span>
            </div>
            <span style={{ fontSize: '32px', fontWeight: 300, color: '#6366f1' }}>72°</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Wind</span>
              <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 500 }}>12 mph W</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Humidity</span>
              <span style={{ fontSize: '12px', color: '#e2e8f0', fontWeight: 500 }}>64%</span>
            </div>
          </div>
        </div>
      );

    case 'tasks':
      return (
        <div className="widget-tasks" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>Daily Checklist</h3>
            <span style={{ fontSize: '11px', background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              {tasks.filter(t => t.done).length}/{tasks.length} Done
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {tasks.map(task => (
              <label 
                key={task.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  fontSize: '12px', 
                  color: task.done ? '#64748b' : '#cbd5e1', 
                  cursor: 'pointer',
                  userSelect: 'none',
                  textDecoration: task.done ? 'line-through' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <input 
                  type="checkbox" 
                  checked={task.done} 
                  onChange={() => toggleTask(task.id)}
                  style={{
                    accentColor: '#8b5cf6',
                    cursor: 'pointer',
                  }}
                />
                {task.text}
              </label>
            ))}
          </div>
        </div>
      );

    case 'html':
      return (
        <div 
          style={{ 
            fontSize: '13px', 
            lineHeight: '1.6', 
            color: '#cbd5e1',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}
          dangerouslySetInnerHTML={{ __html: content }} 
        />
      );

    case 'text':
    default:
      return (
        <div 
          style={{ 
            fontSize: '13.5px', 
            lineHeight: '1.6', 
            color: '#e2e8f0', 
            whiteSpace: 'pre-wrap',
            background: 'rgba(255, 255, 255, 0.02)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}
        >
          {content}
        </div>
      );
  }
};
