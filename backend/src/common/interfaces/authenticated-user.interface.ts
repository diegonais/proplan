import { UserRole } from '../enums/user-role.enum';

export interface AuthenticatedUser {
  uuid: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: true;
}
