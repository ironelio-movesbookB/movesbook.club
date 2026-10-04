import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken, verifyPassword } from '@/lib/auth';
import {
  isAddableMemberArchiveStatus,
  isAddableMemberUserType,
  NOT_ADDABLE_MEMBER_USER_TYPE_ERROR,
  roleValueForMemberArchiveStatus,
  type AddableMemberArchiveStatus,
} from '@/lib/club/memberArchiveStatus';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { teamId: string } }
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
    const teamId = params.teamId;
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

    // Verify user is admin of this team
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        adminId: userId
      }
    });

    if (!team) {
      return NextResponse.json(
        { error: 'Team not found or access denied' },
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

    if (!isAddableMemberUserType(userToAdd.userType)) {
      return NextResponse.json(
        { error: NOT_ADDABLE_MEMBER_USER_TYPE_ERROR },
        { status: 400 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.teamMember.findFirst({
      where: {
        teamId: teamId,
        athleteId: userToAdd.id
      }
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this team' },
        { status: 409 }
      );
    }

    // Add user to team (role stores archive list: member | pending | not_member)
    const teamMember = await prisma.teamMember.create({
      data: {
        teamId: teamId,
        athleteId: userToAdd.id,
        role,
      },
      include: {
        athlete: {
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
        id: teamMember.id,
        athlete: teamMember.athlete,
        role: teamMember.role,
        jerseyNumber: teamMember.jerseyNumber,
        joinedAt: teamMember.joinedAt
      }
    });
  } catch (error: any) {
    console.error('Error adding team member:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
