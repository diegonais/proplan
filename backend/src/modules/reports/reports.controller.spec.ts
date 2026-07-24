import { Response } from 'express';

import { UserRole } from '../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface';
import { ExportsService, GeneratedExportFile } from './exports.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

describe('ReportsController exports', () => {
  const currentUser: AuthenticatedUser = {
    uuid: '11111111-1111-4111-8111-111111111111',
    name: 'Admin',
    email: 'admin@proplan.local',
    role: UserRole.ADMIN,
    isActive: true,
  };
  const generatedFile: GeneratedExportFile = {
    buffer: Buffer.from('archivo'),
    contentType: 'application/pdf',
    fileName: 'proplan-proyecto-12345678-20260724-1200.pdf',
  };

  it('sets Content-Type, Content-Disposition and Content-Length for PDF exports', async () => {
    const exportsService = {
      generateProjectPdf: jest.fn<Promise<GeneratedExportFile>, [string, AuthenticatedUser]>().mockResolvedValue(
        generatedFile,
      ),
    };
    const { response, setHeaderMock, sendMock } = createMockResponse();
    const controller = new ReportsController(
      {} as ReportsService,
      exportsService as unknown as ExportsService,
    );

    await controller.exportProjectPdf('99999999-9999-4999-8999-999999999999', currentUser, response);

    expect(setHeaderMock).toHaveBeenCalledWith('Content-Type', generatedFile.contentType);
    expect(setHeaderMock).toHaveBeenCalledWith(
      'Content-Disposition',
      `attachment; filename="${generatedFile.fileName}"`,
    );
    expect(setHeaderMock).toHaveBeenCalledWith('Content-Length', '7');
    expect(sendMock).toHaveBeenCalledWith(generatedFile.buffer);
  });
});

interface MockResponse {
  response: Response;
  setHeaderMock: jest.Mock;
  sendMock: jest.Mock;
}

function createMockResponse(): MockResponse {
  const setHeaderMock = jest.fn();
  const sendMock = jest.fn();

  return {
    response: {
      setHeader: setHeaderMock,
      send: sendMock,
    } as unknown as Response,
    setHeaderMock,
    sendMock,
  };
}
