/**
 * Unit tests for ProviderHealthTable component
 * Requirements: 15.1, 15.4
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProviderHealthTable from '../../../components/ProviderHealthTable';

// Mock fetch
global.fetch = jest.fn();

describe('ProviderHealthTable', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock localStorage
    Storage.prototype.getItem = jest.fn(() => 'test-token');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('displays status correctly for healthy provider', async () => {
    /**
     * Test that ProviderHealthTable displays status correctly
     * Requirement 15.1: Display current health status per provider/feature
     */
    const mockHealthData = [
      {
        provider: 'gemini',
        feature: 'chat',
        status: 'healthy',
        active_keys: 2,
        degraded_keys: 0,
        disabled_keys: 1,
        recent_failures: []
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<ProviderHealthTable />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('gemini')).toBeInTheDocument();
    });

    // Check that status is displayed correctly
    expect(screen.getByText('healthy')).toBeInTheDocument();
    expect(screen.getByText('chat')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // active_keys
  });

  it('displays status correctly for degraded provider', async () => {
    /**
     * Test that degraded status is displayed correctly
     * Requirement 15.1: Display current health status per provider/feature
     */
    const mockHealthData = [
      {
        provider: 'openai',
        feature: 'flashcard',
        status: 'degraded',
        active_keys: 0,
        degraded_keys: 1,
        disabled_keys: 0,
        recent_failures: [
          {
            checked_at: '2024-01-01T00:00:00Z',
            status: 'degraded',
            error_message: 'High latency detected',
            response_time_ms: 5000
          }
        ]
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<ProviderHealthTable />);

    await waitFor(() => {
      expect(screen.getByText('openai')).toBeInTheDocument();
    });

    expect(screen.getByText('degraded')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // recent_failures count
  });

  it('displays status correctly for failed provider', async () => {
    /**
     * Test that failed status is displayed correctly
     * Requirement 15.1: Display current health status per provider/feature
     */
    const mockHealthData = [
      {
        provider: 'ollama',
        feature: 'mcq',
        status: 'failed',
        active_keys: 0,
        degraded_keys: 0,
        disabled_keys: 2,
        recent_failures: [
          {
            checked_at: '2024-01-01T00:00:00Z',
            status: 'failed',
            error_message: 'Connection timeout',
            response_time_ms: null
          }
        ]
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<ProviderHealthTable />);

    await waitFor(() => {
      expect(screen.getByText('ollama')).toBeInTheDocument();
    });

    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('displays recent failure logs when row is expanded', async () => {
    /**
     * Test that recent failure logs are displayed
     * Requirement 15.2: Display recent failure logs
     */
    const mockHealthData = [
      {
        provider: 'gemini',
        feature: 'chat',
        status: 'healthy',
        active_keys: 1,
        degraded_keys: 0,
        disabled_keys: 0,
        recent_failures: [
          {
            checked_at: '2024-01-01T12:00:00Z',
            status: 'failed',
            error_message: 'API quota exceeded',
            response_time_ms: null
          },
          {
            checked_at: '2024-01-01T11:00:00Z',
            status: 'degraded',
            error_message: 'Slow response',
            response_time_ms: 3000
          }
        ]
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<ProviderHealthTable />);

    await waitFor(() => {
      expect(screen.getByText('gemini')).toBeInTheDocument();
    });

    // Click to expand row
    const row = screen.getByText('gemini').closest('tr');
    fireEvent.click(row!);

    // Check that failure details are displayed
    await waitFor(() => {
      expect(screen.getByText('Recent Failures:')).toBeInTheDocument();
      expect(screen.getByText('API quota exceeded')).toBeInTheDocument();
      expect(screen.getByText('Slow response')).toBeInTheDocument();
    });
  });

  it('triggers manual health check when button is clicked', async () => {
    /**
     * Test that manual health check triggers API call
     * Requirement 15.4: Implement manual health check trigger button
     */
    const mockHealthData = [
      {
        provider: 'gemini',
        feature: 'chat',
        status: 'healthy',
        active_keys: 1,
        degraded_keys: 0,
        disabled_keys: 0,
        recent_failures: []
      }
    ];

    // Mock initial fetch
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<ProviderHealthTable />);

    await waitFor(() => {
      expect(screen.getByText('gemini')).toBeInTheDocument();
    });

    // Mock health check trigger
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Health checks completed for 1 keys', checked_count: 1 }),
    });

    // Mock refresh fetch
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    // Mock window.alert
    window.alert = jest.fn();

    // Click the manual check button
    const checkButton = screen.getByText('Run Health Checks');
    fireEvent.click(checkButton);

    // Wait for the API call
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/provider-health/check'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    // Check that alert was shown
    expect(window.alert).toHaveBeenCalledWith('Health checks completed for 1 keys');
  });

  it('displays loading state initially', () => {
    /**
     * Test that loading state is displayed while fetching data
     */
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<ProviderHealthTable />);

    expect(screen.getByText('Loading provider health data...')).toBeInTheDocument();
  });

  it('displays error message when fetch fails', async () => {
    /**
     * Test that error message is displayed when API call fails
     */
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(<ProviderHealthTable />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('displays empty state when no health data is available', async () => {
    /**
     * Test that empty state is displayed when no data is returned
     */
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    render(<ProviderHealthTable />);

    await waitFor(() => {
      expect(screen.getByText('No provider health data available')).toBeInTheDocument();
    });
  });

  it('displays current failover status', async () => {
    /**
     * Test that current failover status is displayed
     * Requirement 15.3: Display current failover status
     */
    const mockHealthData = [
      {
        provider: 'gemini',
        feature: 'chat',
        status: 'degraded',
        active_keys: 0,
        degraded_keys: 1,
        disabled_keys: 1,
        recent_failures: []
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<ProviderHealthTable />);

    await waitFor(() => {
      expect(screen.getByText('gemini')).toBeInTheDocument();
    });

    // Check that degraded status indicates failover
    expect(screen.getByText('degraded')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // active_keys = 0 indicates failover
    expect(screen.getByText('1')).toBeInTheDocument(); // degraded_keys = 1
  });

  it('auto-refreshes data every 30 seconds', async () => {
    /**
     * Test that data is auto-refreshed periodically
     */
    jest.useFakeTimers();

    const mockHealthData = [
      {
        provider: 'gemini',
        feature: 'chat',
        status: 'healthy',
        active_keys: 1,
        degraded_keys: 0,
        disabled_keys: 0,
        recent_failures: []
      }
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealthData,
    });

    render(<ProviderHealthTable />);

    await waitFor(() => {
      expect(screen.getByText('gemini')).toBeInTheDocument();
    });

    // Initial fetch
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Fast-forward 30 seconds
    jest.advanceTimersByTime(30000);

    // Should have fetched again
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });
});
