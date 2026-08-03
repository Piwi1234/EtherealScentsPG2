import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { PrismaService } from "../common/prisma.service";

type UserRow = { id: string; email: string; firstName: string; lastName: string; passwordHash: string; isActive: boolean; role: { name: string } };

const PASSWORD_POLICY = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`.trim();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = (await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { role: true },
    })) as unknown as UserRow | null;

    const passwordIsValid = user ? await compare(password, user.passwordHash) : false;

    if (!user || !passwordIsValid || !user.isActive) {
      throw new UnauthorizedException("Credenciales inválidas");
    }

    const name = fullName(user);
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      name,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.name,
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email, name, firstName: user.firstName, lastName: user.lastName, role: user.role.name },
    };
  }

  async getProfile(userId: string) {
    const user = (await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    })) as unknown as UserRow | null;

    if (!user) return null;
    return { id: user.id, email: user.email, name: fullName(user), firstName: user.firstName, lastName: user.lastName, role: user.role.name };
  }

  async register(email: string, password: string, firstName: string, lastName: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) throw new UnauthorizedException("El email ya está registrado");

    const userRole = await this.prisma.role.findUnique({ where: { name: "USER" } });
    if (!userRole) throw new Error("Role USER no encontrado — ¿corriste el seed?");

    if (!PASSWORD_POLICY.test(password)) {
      throw new UnauthorizedException("La contraseña debe tener 8+ caracteres, una mayúscula, un número y un símbolo");
    }

    const passwordHash = await hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email: normalizedEmail, passwordHash, firstName: firstName.trim(), lastName: lastName.trim(), roleId: userRole.id },
    });

    return { ...user, name: fullName(user) };
  }
}
