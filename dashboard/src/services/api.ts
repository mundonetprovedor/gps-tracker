import type { TeamMember, ServiceOrder, DashboardStats } from '@/types'

function getToken(): string | null {
  return localStorage.getItem('m_token')
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  if (res.status === 401) {
    throw new Error('Unauthorized')
  }

  return res.json()
}

export async function login(password: string): Promise<{ token: string }> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) throw new Error('Invalid password')
  return res.json()
}

export async function fetchTeams(): Promise<TeamMember[]> {
  return apiFetch<TeamMember[]>('/api/teams')
}

export async function fetchStats(): Promise<DashboardStats> {
  return apiFetch<DashboardStats>('/api/dashboard/stats')
}

export async function fetchServiceOrders(): Promise<ServiceOrder[]> {
  return apiFetch<ServiceOrder[]>('/api/service-orders')
}

export async function fetchActivities(): Promise<{ id: string; message: string; type: string; timestamp: string }[]> {
  return apiFetch('/api/activities')
}

export async function sendPushNotification(techId: string, title: string, body: string): Promise<void> {
  return apiFetch('/api/notifications/send', {
    method: 'POST',
    body: JSON.stringify({ teamId: techId, title, body }),
  })
}
