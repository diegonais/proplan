import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { Project } from '../projects/entities/project.entity';
import { TaskAssignment } from '../task-assignments/entities/task-assignment.entity';
import { User } from '../users/entities/user.entity';
import { CreateProjectMemberDto } from './dto/create-project-member.dto';
import { ProjectMemberCandidateResponseDto } from './dto/project-member-candidate-response.dto';
import { ProjectMemberResponseDto } from './dto/project-member-response.dto';
import { WorkloadItemResponseDto } from './dto/workload-response.dto';
import { ProjectMember } from './entities/project-member.entity';

interface ActiveAssignmentSummary {
  assignmentUuid: string;
  taskUuid: string;
  taskName: string;
  assignedHours: string;
  isMainResponsible: boolean;
}

@Injectable()
export class ProjectMembersService {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly projectMembersRepository: Repository<ProjectMember>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(TaskAssignment)
    private readonly taskAssignmentsRepository: Repository<TaskAssignment>,
  ) {}

  async create(
    projectUuid: string,
    createProjectMemberDto: CreateProjectMemberDto,
    currentUser: AuthenticatedUser,
  ): Promise<ProjectMemberResponseDto> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    this.ensureCanManageProject(project, currentUser);

    const user = await this.usersRepository.findOne({
      where: { uuid: createProjectMemberDto.userUuid },
    });

    if (user === null) {
      throw new BadRequestException('El usuario seleccionado no existe.');
    }

    if (!user.isActive) {
      throw new BadRequestException('Solo usuarios activos pueden agregarse al proyecto.');
    }

    const existingMember = await this.projectMembersRepository.findOne({
      where: { projectUuid: project.uuid, userUuid: user.uuid },
    });

    if (existingMember !== null) {
      throw new ConflictException('El usuario ya pertenece al proyecto.');
    }

    const member = await this.projectMembersRepository.save(
      this.projectMembersRepository.create({
        projectUuid: project.uuid,
        userUuid: user.uuid,
      }),
    );
    member.user = user;

    return ProjectMemberResponseDto.fromEntity(member);
  }

  async findAll(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<ProjectMemberResponseDto[]> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    await this.ensureCanAccessProject(project, currentUser);

    const members = await this.projectMembersRepository.find({
      where: { projectUuid: project.uuid },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
    const workloadByUser = await this.getWorkloadTotals(project.uuid);

    return members.map((member) =>
      ProjectMemberResponseDto.fromEntity(member, workloadByUser.get(member.userUuid) ?? '0.00'),
    );
  }

  async findCandidates(
    projectUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<ProjectMemberCandidateResponseDto[]> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    this.ensureCanManageProject(project, currentUser);

    const members = await this.projectMembersRepository.find({
      where: { projectUuid: project.uuid },
    });
    const memberUuids = new Set(members.map((member) => member.userUuid));
    const users = await this.usersRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });

    return users
      .filter((user) => !memberUuids.has(user.uuid))
      .map((user) => ProjectMemberCandidateResponseDto.fromEntity(user));
  }

  async remove(projectUuid: string, userUuid: string, currentUser: AuthenticatedUser): Promise<void> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    this.ensureCanManageProject(project, currentUser);

    if (project.managerUuid === userUuid) {
      throw new BadRequestException('El jefe del proyecto debe permanecer como miembro.');
    }

    const member = await this.projectMembersRepository.findOne({
      where: { projectUuid: project.uuid, userUuid },
    });

    if (member === null) {
      throw new NotFoundException('Miembro del proyecto no encontrado.');
    }

    const activeAssignments = await this.findActiveAssignments(project.uuid, userUuid);

    if (activeAssignments.length > 0) {
      throw new BadRequestException({
        message:
          'No se puede retirar el miembro porque tiene asignaciones activas. Resuelva las asignaciones antes de retirarlo.',
        assignments: activeAssignments,
      });
    }

    await this.projectMembersRepository.remove(member);
  }

  async getWorkload(
    projectUuid: string,
    currentUser: AuthenticatedUser,
    userUuid?: string,
  ): Promise<WorkloadItemResponseDto[]> {
    const project = await this.findActiveProjectOrFail(projectUuid);
    await this.ensureCanAccessProject(project, currentUser);

    if (currentUser.role === UserRole.USER && userUuid !== undefined && userUuid !== currentUser.uuid) {
      throw new ForbiddenException('El rol Usuario solo puede consultar su propia carga de trabajo.');
    }

    const members = await this.projectMembersRepository.find({
      where: userUuid === undefined ? { projectUuid: project.uuid } : { projectUuid: project.uuid, userUuid },
      relations: { user: true },
      order: { joinedAt: 'ASC' },
    });
    const workloadByUser = await this.getWorkloadTotals(project.uuid, userUuid);

    return members.map((member) => ({
      projectUuid: project.uuid,
      userUuid: member.userUuid,
      user: {
        uuid: member.user.uuid,
        name: member.user.name,
        email: member.user.email,
        role: member.user.role,
      },
      assignedHours: workloadByUser.get(member.userUuid) ?? '0.00',
    }));
  }

  private async findActiveProjectOrFail(uuid: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { uuid } });

    if (project === null) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    return project;
  }

  private async ensureCanAccessProject(
    project: Project,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    if (currentUser.role === UserRole.USER && (await this.isProjectMember(project.uuid, currentUser.uuid))) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para consultar el equipo de este proyecto.');
  }

  private ensureCanManageProject(project: Project, currentUser: AuthenticatedUser): void {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para gestionar miembros de este proyecto.');
  }

  private async isProjectMember(projectUuid: string, userUuid: string): Promise<boolean> {
    const membershipCount = await this.projectMembersRepository.count({
      where: { projectUuid, userUuid },
    });

    return membershipCount > 0;
  }

  private async findActiveAssignments(
    projectUuid: string,
    userUuid: string,
  ): Promise<ActiveAssignmentSummary[]> {
    const assignments = await this.taskAssignmentsRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.task', 'task')
      .where('task.projectUuid = :projectUuid', { projectUuid })
      .andWhere('assignment.userUuid = :userUuid', { userUuid })
      .andWhere('task.deletedAt IS NULL')
      .orderBy('task.name', 'ASC')
      .getMany();

    return assignments.map((assignment) => ({
      assignmentUuid: assignment.uuid,
      taskUuid: assignment.taskUuid,
      taskName: assignment.task.name,
      assignedHours: assignment.assignedHours,
      isMainResponsible: assignment.isMainResponsible,
    }));
  }

  private async getWorkloadTotals(projectUuid: string, userUuid?: string): Promise<Map<string, string>> {
    const queryBuilder = this.taskAssignmentsRepository
      .createQueryBuilder('assignment')
      .innerJoin('assignment.task', 'task')
      .select('assignment.userUuid', 'userUuid')
      .addSelect('COALESCE(SUM(assignment.assignedHours), 0)', 'assignedHours')
      .where('task.projectUuid = :projectUuid', { projectUuid })
      .andWhere('task.deletedAt IS NULL')
      .groupBy('assignment.userUuid');

    if (userUuid !== undefined) {
      queryBuilder.andWhere('assignment.userUuid = :userUuid', { userUuid });
    }

    const rows = await queryBuilder.getRawMany<{ userUuid: string; assignedHours: string }>();

    return new Map(rows.map((row) => [row.userUuid, Number(row.assignedHours).toFixed(2)]));
  }
}
