import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Query, 
  Param, 
  Patch, 
  Delete,
  UseGuards, 
  Request 
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

//@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // =====================================
  // ฝั่งตารางงาน (Work Schedules)
  // =====================================

  // 1. ดึงตารางแพทย์ที่ว่าง (สำหรับผู้ปกครองเลือกจอง)
  @Get('schedules')
  getSchedules(
    @Request() req: any,
    @Query('staffId') staffId?: number,
    @Query('date') date?: string
  ) {
    return this.appointmentsService.getAvailableSchedules(req.user, staffId, date);
  }

  // 2. หมอดูตารางงานของตัวเองทั้งหมด (ทั้งว่างและถูกจองแล้ว)
  @Get('my-schedules')
  getMySchedules(@Request() req: any) {
    return this.appointmentsService.getMySchedules(req.user);
  }

  // 3. หมอเพิ่มตารางงานของตัวเอง
  @Post('schedules')
  createSchedule(
    @Request() req: any,
    @Body() data: { work_date: string; start_time: string; end_time: string }
  ) {
    return this.appointmentsService.createWorkSchedule(req.user, data);
  }

  // 4. หมอแก้ไขตารางงาน
  @Patch('schedules/:id')
  updateSchedule(
    @Request() req: any,
    @Param('id') id: string,
    @Body() data: { work_date?: string; start_time?: string; end_time?: string; slot_status?: any }
  ) {
    return this.appointmentsService.updateWorkSchedule(req.user, Number(id), data);
  }

  // 5. หมอลบตารางงาน
  @Delete('schedules/:id')
  deleteSchedule(@Request() req: any, @Param('id') id: string) {
    return this.appointmentsService.deleteWorkSchedule(req.user, Number(id));
  }


  // =====================================
  // ฝั่งการจอง (Appointments)
  // =====================================

  @Get()
  getAppointments(
    @Request() req: any,
    @Query('patientId') patientId?: number,
    @Query('date') date?: string
  ) {
    return this.appointmentsService.getAppointments(req.user, patientId, date);
  }

  @Post()
  bookAppointment(
    @Request() req: any, 
    @Body() createDto: { patient_id: number; schedule_id: number; room_id?: number }
  ) {
    return this.appointmentsService.bookAppointment(req.user, createDto);
  }

  @Patch(':id/cancel')
  cancelAppointment(@Request() req: any, @Param('id') id: string) {
    return this.appointmentsService.cancelAppointment(req.user, Number(id));
  }
}