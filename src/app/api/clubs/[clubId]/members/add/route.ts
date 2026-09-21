import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken, verifyPassword } from '@/lib/auth';
import {
  isAddableMemberArchiveStatus,
  roleValueForMemberArchiveStatus,
  type AddableMemberArchiveStatus,
} from '@/lib/club/memberArchiveStatus';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { clubId: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decoded.userId;
    const clubId = params.clubId;
    const body = await request.json();
    const { username, password, membershipStatus: rawStatus } = body as {
      username?: string;
      password?: string;
      membershipStatus?: string;
    };

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (!rawStatus || !isAddableMemberArchiveStatus(String(rawStatus))) {
      return NextResponse.json(
        {
          error:
            'membershipStatus is required and must be member, pending, or not_member',
        },
        { status: 400 },
      );
    }
    const membershipStatus = rawStatus as AddableMemberArchiveStatus;
    const role = roleValueForMemberArchiveStatus(membershipStatus);

    // Verify user is admin of this club
    const club = await prisma.club.findFirst({
      where: {
        id: clubId,
        adminId: userId
      }
    });

    if (!club) {
      return NextResponse.json(
        { error: 'Club not found or access denied' },
        { status: 404 }
      );
    }

    // Find user by username
    const userToAdd = await prisma.user.findUnique({
      where: {
        username: username
      }
    });

    if (!userToAdd) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, userToAdd.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.clubMember.findFirst({
      where: {
        clubId: clubId,
        memberId: userToAdd.id
      }
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this club' },
        { status: 409 }
      );
    }

    // Add user to club
    const clubMember = await prisma.clubMember.create({
      data: {
        clubId: clubId,
        memberId: userToAdd.id,
        role,
        membershipType: 'Standard',
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            username: true,
            email: true,
            userType: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      member: {
        id: clubMember.id,
        member: clubMember.member,
        role: clubMember.role,
        membershipType: clubMember.membershipType,
        joinedAt: clubMember.joinedAt
      }
    });
  } catch (error: any) {
    console.error('Error adding club member:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
