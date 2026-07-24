import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ProjectMember } from '../project-members/entities/project-member.entity';
import { Project } from '../projects/entities/project.entity';
import { Task } from '../tasks/entities/task.entity';
import { User } from '../users/entities/user.entity';
import { CreateTaskAssignmentDto } from './dto/create-task-assignment.dto';
import { TaskAssignmentResponseDto } from './dto/task-assignment-response.dto';
import { UpdateTaskAssignmentDto } from './dto/update-task-assignment.dto';
import { TaskAssignment } from './entities/task-assignment.entity';

@Injectable()
export class TaskAssignmentsService {
  constructor(
    @InjectRepository(TaskAssignment)
    private readonly taskAssignmentsRepository: Repository<TaskAssignment>,
    @InjectRepository(Task)
    private readonly tasksRepository: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectsRepository: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly projectMembersRepository: Repository<ProjectMember>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    taskUuid: string,
    createTaskAssignmentDto: CreateTaskAssignmentDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskAssignmentResponseDto> {
    const task = await this.findActiveTaskOrFail(taskUuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);
    this.ensureCanManageProject(project, currentUser);
    const user = await this.findAssignableUserOrFail(project.uuid, createTaskAssignmentDto.userUuid);

    const existingAssignment = await this.taskAssignmentsRepository.findOne({
      where: { taskUuid: task.uuid, userUuid: user.uuid },
    });

    if (existingAssignment !== null) {
      throw new ConflictException('El usuario ya esta asignado a esta actividad.');
    }

    const assignment = await this.dataSource.transaction(async (entityManager) => {
      const assignmentRepository = entityManager.getRepository(TaskAssignment);
      const newAssignment = await assignmentRepository.save(
        assignmentRepository.create({
          taskUuid: task.uuid,
          userUuid: user.uuid,
          assignedHours: formatDecimal(createTaskAssignmentDto.assignedHours),
          isMainResponsible: false,
        }),
      );

      if (createTaskAssignmentDto.isMainResponsible === true) {
        await this.markMainResponsible(assignmentRepository, task.uuid, newAssignment.uuid);
        newAssignment.isMainResponsible = true;
      }

      return newAssignment;
    });

    assignment.user = user;
    return TaskAssignmentResponseDto.fromEntity(assignment);
  }

  async findAll(
    taskUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<TaskAssignmentResponseDto[]> {
    const task = await this.findActiveTaskOrFail(taskUuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);
    await this.ensureCanAccessTask(task, project, currentUser);

    const assignments = await this.taskAssignmentsRepository.find({
      where: { taskUuid: task.uuid },
      relations: { user: true },
      order: { isMainResponsible: 'DESC', uuid: 'ASC' },
    });

    return assignments.map((assignment) => TaskAssignmentResponseDto.fromEntity(assignment));
  }

  async update(
    uuid: string,
    updateTaskAssignmentDto: UpdateTaskAssignmentDto,
    currentUser: AuthenticatedUser,
  ): Promise<TaskAssignmentResponseDto> {
    const assignment = await this.findAssignmentOrFail(uuid);
    const task = await this.findActiveTaskOrFail(assignment.taskUuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);
    this.ensureCanManageProject(project, currentUser);

    if (updateTaskAssignmentDto.assignedHours !== undefined) {
      assignment.assignedHours = formatDecimal(updateTaskAssignmentDto.assignedHours);
    }

    const savedAssignment = await this.taskAssignmentsRepository.save(assignment);
    const reloadedAssignment = await this.findAssignmentOrFail(savedAssignment.uuid);

    return TaskAssignmentResponseDto.fromEntity(reloadedAssignment);
  }

  async remove(uuid: string, currentUser: AuthenticatedUser): Promise<void> {
    const assignment = await this.findAssignmentOrFail(uuid);
    const task = await this.findActiveTaskOrFail(assignment.taskUuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);
    this.ensureCanManageProject(project, currentUser);

    await this.taskAssignmentsRepository.remove(assignment);
  }

  async setMainResponsible(
    taskUuid: string,
    userUuid: string,
    currentUser: AuthenticatedUser,
  ): Promise<TaskAssignmentResponseDto> {
    const task = await this.findActiveTaskOrFail(taskUuid);
    const project = await this.findActiveProjectOrFail(task.projectUuid);
    this.ensureCanManageProject(project, currentUser);

    const assignment = await this.taskAssignmentsRepository.findOne({
      where: { taskUuid: task.uuid, userUuid },
      relations: { user: true },
    });

    if (assignment === null) {
      throw new BadRequestException('El responsable principal debe estar asignado a la actividad.');
    }

    if (!assignment.user.isActive) {
      throw new BadRequestException('No se puede seleccionar un usuario inactivo como responsable principal.');
    }

    await this.ensureUserIsProjectMember(project.uuid, userUuid);

    const updatedAssignment = await this.dataSource.transaction(async (entityManager) => {
      const assignmentRepository = entityManager.getRepository(TaskAssignment);
      await this.markMainResponsible(assignmentRepository, task.uuid, assignment.uuid);

      const reloadedAssignment = await assignmentRepository.findOne({
        where: { uuid: assignment.uuid },
        relations: { user: true },
      });

      if (reloadedAssignment === null) {
        throw new NotFoundException('Asignacion de actividad no encontrada.');
      }

      return reloadedAssignment;
    });

    return TaskAssignmentResponseDto.fromEntity(updatedAssignment);
  }

  private async findActiveTaskOrFail(uuid: string): Promise<Task> {
    const task = await this.tasksRepository.findOne({ where: { uuid } });

    if (task === null) {
      throw new NotFoundException('Actividad no encontrada.');
    }

    return task;
  }

  private async findActiveProjectOrFail(uuid: string): Promise<Project> {
    const project = await this.projectsRepository.findOne({ where: { uuid } });

    if (project === null) {
      throw new NotFoundException('Proyecto no encontrado.');
    }

    return project;
  }

  private async findAssignmentOrFail(uuid: string): Promise<TaskAssignment> {
    const assignment = await this.taskAssignmentsRepository.findOne({
      where: { uuid },
      relations: { user: true },
    });

    if (assignment === null) {
      throw new NotFoundException('Asignacion de actividad no encontrada.');
    }

    return assignment;
  }

  private async findAssignableUserOrFail(projectUuid: string, userUuid: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { uuid: userUuid } });

    if (user === null) {
      throw new BadRequestException('El usuario seleccionado no existe.');
    }

    if (!user.isActive) {
      throw new BadRequestException('No se puede asignar un usuario inactivo.');
    }

    await this.ensureUserIsProjectMember(projectUuid, user.uuid);

    return user;
  }

  private async ensureUserIsProjectMember(projectUuid: string, userUuid: string): Promise<void> {
    const membershipCount = await this.projectMembersRepository.count({
      where: { projectUuid, userUuid },
    });

    if (membershipCount === 0) {
      throw new BadRequestException('El usuario debe pertenecer al proyecto antes de ser asignado.');
    }
  }

  private async ensureCanAccessTask(
    task: Task,
    project: Project,
    currentUser: AuthenticatedUser,
  ): Promise<void> {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    const assignmentCount = await this.taskAssignmentsRepository.count({
      where: { taskUuid: task.uuid, userUuid: currentUser.uuid },
    });

    if (currentUser.role === UserRole.USER && assignmentCount > 0) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para consultar asignaciones de esta actividad.');
  }

  private ensureCanManageProject(project: Project, currentUser: AuthenticatedUser): void {
    if (currentUser.role === UserRole.ADMIN) {
      return;
    }

    if (currentUser.role === UserRole.PROJECT_MANAGER && project.managerUuid === currentUser.uuid) {
      return;
    }

    throw new ForbiddenException('No tiene permiso para administrar asignaciones de este proyecto.');
  }

  private async markMainResponsible(
    assignmentRepository: Repository<TaskAssignment>,
    taskUuid: string,
    assignmentUuid: string,
  ): Promise<void> {
    await assignmentRepository.update({ taskUuid }, { isMainResponsible: false });
    await assignmentRepository.update({ uuid: assignmentUuid }, { isMainResponsible: true });
  }
}

function formatDecimal(value: number): string {
  return value.toFixed(2);
}
