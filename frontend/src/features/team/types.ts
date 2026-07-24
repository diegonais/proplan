import { UserRole } from '../auth/types';

export interface TeamUser {
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface ProjectMember {
  uuid: string;
  projectUuid: string;
  userUuid: string;
  joinedAt: string;
  user: TeamUser;
  assignedHours: string;
}

export interface ProjectMemberCandidate {
  uuid: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

export interface WorkloadItem {
  projectUuid: string;
  userUuid: string;
  user: Omit<TeamUser, 'isActive'>;
  assignedHours: string;
}
