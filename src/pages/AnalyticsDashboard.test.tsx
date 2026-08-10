import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import AnalyticsDashboard from './AnalyticsDashboard';
import { supabase } from '@/integrations/supabase/client';

// Mock matchMedia for Recharts
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // Deprecated
    removeListener: vi.fn(), // Deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});


// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};


vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } })
    },
    from: vi.fn((table) => {
      if (table === 'user_resource_analytics') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({
              data: [
                { total_attempts: 10, total_time_spent: 600, completed_attempts: 5, average_score: 80 }
              ],
              error: null
            })
          }))
        };
      }
      if (table === 'user_topic_mastery') {
         return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn().mockResolvedValue({
                data: [
                  { topic: 'Calculus', mastery_level: 0.9, attempts_count: 20 }
                ],
                error: null
              })
            }))
          }))
        };
      }
      return {};
    })
  }
}));

describe('AnalyticsDashboard', () => {
  it('renders correctly and calculates stats without crashing', async () => {
    render(
      <BrowserRouter>
        <AnalyticsDashboard />
      </BrowserRouter>
    );

    expect(screen.getByText('Performance Analytics')).toBeInTheDocument();

    await waitFor(() => {
       // Should show the total attempts (10)
       expect(screen.getByText('10')).toBeInTheDocument();
       // Should show time spent (600s = 10m)
       expect(screen.getByText('10m')).toBeInTheDocument();
       // Should show average score (80%)
       expect(screen.getByText('80%')).toBeInTheDocument();

       // Topic mastery
       expect(screen.getByText('Calculus')).toBeInTheDocument();
       expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });
});
