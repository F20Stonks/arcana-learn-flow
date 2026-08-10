import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ResourceBank from './ResourceBank';
import { supabase } from '@/integrations/supabase/client';

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                id: '1',
                source_competition: 'Putnam',
                year: 2025,
                subject: 'Mathematics',
                difficulty: 'hard',
                language: 'English',
                resource_type: 'past_paper',
                learning_track: 'Putnam'
              }
            ],
            error: null
          })
        }))
      }))
    })),
    storage: {
      from: vi.fn(() => ({
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'mock-url' } })
      }))
    }
  }
}));

describe('ResourceBank', () => {
  it('renders correctly and fetches data without crashing', async () => {
    render(
      <BrowserRouter>
        <ResourceBank />
      </BrowserRouter>
    );

    // Initial render should show loading skeleton or title
    expect(screen.getByText('Global Resource Bank')).toBeInTheDocument();

    // Wait for the mock data to load
    await waitFor(() => {
      expect(screen.getByText('Putnam (2025)')).toBeInTheDocument();
    });

    // Check if Practice link has correct parameters (it was bugged before)
    const practiceButton = screen.getByText('Practice');
    expect(practiceButton).toBeInTheDocument();

    // We can't strictly test window.location.href in standard RTL easily without mocking window,
    // but ensuring it doesn't crash is step 1.
  });
});
