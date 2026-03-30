import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, invoice_status, payment_status } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OmiseLib = require('omise').Omise ?? require('omise');
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateOmiseChargeDto } from './dto/create-omise-charge.dto';

type AuthUser = {
  user_id: number;
  user_type: 'staff' | 'parent';
  staffRole?: string | null;
  roleNames?: string[];
};

@Injectable()
export class PaymentService {
  private _omise: any;

  private get omise() {
    if (!this._omise) {
      this._omise = OmiseLib({
        publicKey: process.env.OMISE_PUBLIC_KEY!,
        secretKey: process.env.OMISE_SECRET_KEY!,
        omiseVersion: '2019-05-29',
      });
    }
    return this._omise;
  }

  constructor(private readonly prisma: PrismaService) {}

  /** Parent submits payment with slip */
  async createPayment(user: AuthUser, dto: CreatePaymentDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { invoice_id: dto.invoiceId },
      include: {
        visit: {
          include: {
            appointments: { select: { patient_id: true } },
          },
        },
        payment: { where: { deleted_at: null } },
      },
    });

    if (!invoice || invoice.deleted_at) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === invoice_status.paid) {
      throw new BadRequestException('Invoice is already paid');
    }

    if (user.user_type === 'parent') {
      const childId = invoice.visit?.appointments?.patient_id;
      if (childId) {
        const link = await this.prisma.child_parent.findFirst({
          where: {
            child_id: childId,
            parent: { user_id: user.user_id },
          },
        });
        if (!link) {
          throw new ForbiddenException('You can only pay for your own children');
        }
      }
    }

    const existingPending = invoice.payment.find(
      (p) => p.status === payment_status.pending,
    );
    if (existingPending) {
      throw new BadRequestException(
        'There is already a pending payment for this invoice. Please wait for staff confirmation.',
      );
    }

    const amount = invoice.total_amount ?? new Prisma.Decimal(0);

    const payment = await this.prisma.payment.create({
      data: {
        invoice_id: dto.invoiceId,
        amount,
        method: 'qr_code',
        status: payment_status.pending,
        slip_image: dto.slipImage ?? null,
      },
    });

    return this.mapPayment(payment);
  }

  /** เช็ค charge status จาก Omise */
  async getChargeStatus(chargeId: string) {
    const charge = await this.omise.charges.retrieve(chargeId);
    return { status: charge.status };
  }

  /** Parent creates Omise PromptPay charge */
  async createOmiseCharge(user: AuthUser, dto: CreateOmiseChargeDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { invoice_id: dto.invoiceId },
      include: {
        visit: {
          include: {
            appointments: { select: { patient_id: true } },
          },
        },
        payment: { where: { deleted_at: null } },
      },
    });

    if (!invoice || invoice.deleted_at) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === invoice_status.paid) {
      throw new BadRequestException('Invoice is already paid');
    }

    if (user.user_type === 'parent') {
      const childId = invoice.visit?.appointments?.patient_id;
      if (childId) {
        const link = await this.prisma.child_parent.findFirst({
          where: {
            child_id: childId,
            parent: { user_id: user.user_id },
          },
        });
        if (!link) {
          throw new ForbiddenException('You can only pay for your own children');
        }
      }
    }

    const existingPending = invoice.payment.find(
      (p) => p.status === payment_status.pending,
    );
    if (existingPending) {
      await this.prisma.payment.update({
        where: { payment_id: existingPending.payment_id },
        data: { deleted_at: new Date() },
      });
    }

    const amountSatang = Math.round(Number(invoice.total_amount ?? 0) * 100);

    if (amountSatang < 2000) {
      throw new BadRequestException('Invoice amount must be at least 20 THB to generate a QR code');
    }

    let source: any;
    let charge: any;
    try {
      source = await this.omise.sources.create({
        type: 'promptpay',
        amount: amountSatang,
        currency: 'THB',
      });

      charge = await this.omise.charges.create({
        amount: amountSatang,
        currency: 'THB',
        source: source.id,
        return_uri: `${process.env.FRONTEND_URL}/payment/parent`,
        metadata: { invoice_id: dto.invoiceId },
      });
    } catch (err: any) {
      throw new BadRequestException(
        err?.message ?? 'Failed to create payment charge. Please try again.',
      );
    }

    await this.prisma.payment.create({
      data: {
        invoice_id: dto.invoiceId,
        amount: invoice.total_amount ?? new Prisma.Decimal(0),
        method: 'promptpay',
        status: payment_status.pending,
        slip_image: charge.id, // เก็บ charge_id ไว้ใช้ verify webhook
      },
    });

    const qrCodeUri = (charge as any)?.source?.scannable_code?.image?.download_uri ?? null;

    return {
      charge_id: charge.id,
      qr_code_uri: qrCodeUri,
      amount: Number(invoice.total_amount ?? 0),
    };
  }

  /** รับ webhook จาก Omise เมื่อ charge สำเร็จ */
  async handleOmiseWebhook(body: any) {
    if (body?.key !== 'charge.complete') return { received: true };

    const charge = body?.data;
    if (!charge?.id || charge?.status !== 'successful') return { received: true };

    const payment = await this.prisma.payment.findFirst({
      where: {
        slip_image: charge.id, // charge_id ที่เก็บไว้
        status: payment_status.pending,
        deleted_at: null,
      },
    });

    if (!payment) return { received: true };

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { payment_id: payment.payment_id },
        data: {
          status: payment_status.confirmed,
          confirmed_at: new Date(),
        },
      });

      await tx.invoice.update({
        where: { invoice_id: payment.invoice_id },
        data: { status: invoice_status.paid },
      });
    });

    return { received: true };
  }

  /** Parent views their payment history */
  async getMyPayments(user: AuthUser) {
    if (user.user_type !== 'parent') {
      throw new ForbiddenException('Only parents can access this');
    }

    const parent = await this.prisma.parent.findFirst({
      where: { user_id: user.user_id },
      include: {
        child_parent: { select: { child_id: true } },
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent profile not found');
    }

    const childIds = parent.child_parent.map((cp) => cp.child_id);

    const payments = await this.prisma.payment.findMany({
      where: {
        deleted_at: null,
        invoice: {
          deleted_at: null,
          visit: {
            appointments: {
              patient_id: { in: childIds.length > 0 ? childIds : [-1] },
            },
          },
        },
      },
      include: {
        invoice: {
          include: {
            visit: {
              include: {
                appointments: {
                  include: {
                    child: {
                      select: {
                        child_id: true,
                        first_name: true,
                        last_name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { payment_date: 'desc' as const },
    });

    return payments.map((p) => ({
      ...this.mapPayment(p),
      invoice_total: p.invoice.total_amount,
      visit_id: p.invoice.visit_id,
      child_name: p.invoice.visit?.appointments?.child
        ? `${p.invoice.visit.appointments.child.first_name} ${p.invoice.visit.appointments.child.last_name}`
        : null,
    }));
  }

  /** Get payments for a specific invoice */
  async getByInvoice(invoiceId: number) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
    });

    if (!invoice || invoice.deleted_at) {
      throw new NotFoundException('Invoice not found');
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        invoice_id: invoiceId,
        deleted_at: null,
      },
      include: {
        staff: {
          select: {
            staff_id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: { payment_date: 'desc' as const },
    });

    return {
      invoice_id: invoice.invoice_id,
      total_amount: invoice.total_amount,
      status: invoice.status,
      payments: payments.map((p) => ({
        ...this.mapPayment(p),
        confirmed_by_name: p.staff
          ? `${p.staff.first_name} ${p.staff.last_name}`
          : null,
      })),
    };
  }

  /** Staff views all pending payments */
  async getPendingPayments(user: AuthUser) {
    this.ensureStaff(user);

    const payments = await this.prisma.payment.findMany({
      where: {
        status: payment_status.pending,
        deleted_at: null,
      },
      include: {
        invoice: {
          include: {
            visit: {
              include: {
                appointments: {
                  include: {
                    child: {
                      select: {
                        child_id: true,
                        first_name: true,
                        last_name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { payment_date: 'asc' as const },
    });

    return payments.map((p) => ({
      ...this.mapPayment(p),
      invoice_total: p.invoice.total_amount,
      child_name: p.invoice.visit?.appointments?.child
        ? `${p.invoice.visit.appointments.child.first_name} ${p.invoice.visit.appointments.child.last_name}`
        : null,
      visit_date: p.invoice.visit?.visit_date ?? null,
    }));
  }

  /** Staff confirms or rejects a payment */
  async confirmPayment(
    user: AuthUser,
    paymentId: number,
    action: 'confirmed' | 'rejected',
  ) {
    this.ensureStaff(user);

    const staff = await this.prisma.staff.findFirst({
      where: { user_id: user.user_id },
    });

    if (!staff) {
      throw new NotFoundException('Staff profile not found');
    }

    const payment = await this.prisma.payment.findUnique({
      where: { payment_id: paymentId },
      include: { invoice: true },
    });

    if (!payment || payment.deleted_at) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== payment_status.pending) {
      throw new BadRequestException(
        `Payment is already ${payment.status}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { payment_id: paymentId },
        data: {
          status: action === 'confirmed' ? payment_status.confirmed : payment_status.rejected,
          confirmed_by: staff.staff_id,
          confirmed_at: new Date(),
        },
      });

      if (action === 'confirmed') {
        await tx.invoice.update({
          where: { invoice_id: payment.invoice_id },
          data: { status: invoice_status.paid },
        });
      }

      return this.mapPayment(updated);
    });
  }

  private ensureStaff(user: AuthUser) {
    if (user.user_type !== 'staff') {
      throw new ForbiddenException('Staff access only');
    }
  }

  private mapPayment(payment: {
    payment_id: number;
    invoice_id: number;
    amount: Prisma.Decimal;
    method: string;
    status: string;
    slip_image: string | null;
    confirmed_by: number | null;
    confirmed_at: Date | null;
    payment_date: Date;
  }) {
    return {
      payment_id: payment.payment_id,
      invoice_id: payment.invoice_id,
      amount: payment.amount,
      method: payment.method,
      status: payment.status,
      slip_image: payment.slip_image,
      confirmed_by: payment.confirmed_by,
      confirmed_at: payment.confirmed_at,
      payment_date: payment.payment_date,
    };
  }
}
