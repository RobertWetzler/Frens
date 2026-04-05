import getEnvVars from 'env';
import { tokenStorage } from 'utils/tokenStorage';

export interface TerritoryTestCell {
  row: number;
  col: number;
}

export interface AssignCellRequest extends TerritoryTestCell {
  userId: string;
  color?: string;
}

export interface AddPowerupRequest extends TerritoryTestCell {
  powerupType: string;
  dateKey?: string;
}

export interface RemovePowerupRequest extends TerritoryTestCell {
  dateKey?: string;
}

export interface SetCellStatusRequest extends TerritoryTestCell {
  status: 'poisoned' | 'unpoisoned';
  poisonedByUserId?: string;
  durationHours?: number;
}

export interface TerritoryTestAssigneeOption {
  userId: string;
  username: string;
}

export interface TerritoryTestEditorOptions {
  assignees: TerritoryTestAssigneeOption[];
  powerupTypes: string[];
  cellStatuses: string[];
}

export interface TerritoryTestCellEditorState {
  row: number;
  col: number;
  assigneeUserId?: string | null;
  assigneeUsername?: string | null;
  powerupType: string;
  cellStatus: string;
}

export interface SaveTerritoryCellEditorRequest extends TerritoryTestCell {
  assigneeUserId?: string | null;
  powerupType: string;
  cellStatus: string;
  dateKey?: string;
}

async function request(path: string, method: string, body?: unknown): Promise<Response> {
  const token = await tokenStorage.getAuthToken();
  const response = await fetch(`${getEnvVars().API_URL}${path}`, {
    method,
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response;
}

export const TerritoryTestModeService = {
  async getMode(): Promise<boolean> {
    const res = await request('/api/TerritoryTest/mode', 'GET');
    const data = await res.json();
    return !!data?.enabled;
  },

  async assignCell(payload: AssignCellRequest): Promise<void> {
    await request('/api/TerritoryTest/cell/assign', 'POST', payload);
  },

  async unassignCell(payload: TerritoryTestCell): Promise<void> {
    await request('/api/TerritoryTest/cell/unassign', 'POST', payload);
  },

  async addPowerup(payload: AddPowerupRequest): Promise<void> {
    await request('/api/TerritoryTest/cell/powerup/add', 'POST', payload);
  },

  async removePowerup(payload: RemovePowerupRequest): Promise<void> {
    await request('/api/TerritoryTest/cell/powerup/remove', 'POST', payload);
  },

  async setCellStatus(payload: SetCellStatusRequest): Promise<void> {
    await request('/api/TerritoryTest/cell/status', 'POST', payload);
  },

  async getEditorOptions(): Promise<TerritoryTestEditorOptions> {
    const res = await request('/api/TerritoryTest/editor/options', 'GET');
    return await res.json();
  },

  async getCellEditorState(row: number, col: number, dateKey?: string): Promise<TerritoryTestCellEditorState> {
    const qs = new URLSearchParams({ row: String(row), col: String(col) });
    if (dateKey) qs.set('dateKey', dateKey);
    const res = await request(`/api/TerritoryTest/editor/cell?${qs.toString()}`, 'GET');
    return await res.json();
  },

  async saveCellEditorState(payload: SaveTerritoryCellEditorRequest): Promise<TerritoryTestCellEditorState> {
    const res = await request('/api/TerritoryTest/editor/save', 'POST', payload);
    return await res.json();
  },
};
