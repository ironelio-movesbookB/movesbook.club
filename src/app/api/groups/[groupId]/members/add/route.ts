import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { verifyToken, verifyPassword } from '@/lib/auth';

const prisma = new PrismaClient();

export async function POST(
  request: NextRequest,
  { params }: { params: { groupId: string } }
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
    const groupId = params.groupId;
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Verify user is admin of this group
    const group = await prisma.group.findFirst({
      where: {
        id: groupId,
        adminId: userId
      }
    });

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found or access denied' },
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
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: userToAdd.id
      }
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this group' },
        { status: 409 }
      );
    }

    // Add user to group
    const groupMember = await prisma.groupMember.create({
      data: {
        groupId: groupId,
        userId: userToAdd.id,
        role: 'member'
      },
      include: {
        user: {
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
        id: groupMember.id,
        user: groupMember.user,
        role: groupMember.role,
        joinedAt: groupMember.joinedAt
      }
    });
  } catch (error: any) {
    console.error('Error adding group member:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

