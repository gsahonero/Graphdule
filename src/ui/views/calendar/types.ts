import { NodeStatus, ProjectStyle } from '../../../domain/models/types';

export type CalendarViewMode = 'month' | 'week' | 'day';

export interface CalendarTaskItem {
  id: string;
  text: string;
  dueDate: string;
  status: NodeStatus;
  estimatedAU?: number;
  projectId?: string;
  projectName?: string;
  projectStyle?: ProjectStyle;
  isStandalone: boolean;
  parentNodeId?: string | null;
  tags?: string[];
}

export interface DayCapacitySummary {
  date: string;
  weekdayName: string;
  plannedAU: number;
  inProgressAU: number;
  completedAU: number;
  dailyCapacityAU: number;
  remainingAU: number;
  percentage: number;
  isOverloaded: boolean;
  overloadDelta: number;
  source: 'default' | 'override' | 'calendar' | 'historical';
  confidence?: number;
  calendarAvailabilityAU?: number;
  tasks: CalendarTaskItem[];
}
