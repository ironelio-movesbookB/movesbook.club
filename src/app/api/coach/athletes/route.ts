import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';


// GET /api/coach/athletes - List all athletes for a coach
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify user is a coach
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !['COACH', 'TEAM_MANAGER', 'CLUB_TRAINER'].includes(user.userType)) {
      return NextResponse.json({ error: 'Unauthorized - Must be a coach' }, { status: 403 });
    }

    // Get all athletes for this coach
    const coachAthletes = await prisma.coachAthlete.findMany({
      where: { coachId: decoded.userId },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            userType: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const athletes = coachAthletes.map(ca => ca.athlete);

    return NextResponse.json({ athletes });
  } catch (error) {
    console.error('Error fetching athletes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch athletes' },
      { status: 500 }
    );
  }
}

// POST /api/coach/athletes - Add an athlete to coach's roster
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = verifyToken(token);
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify user is a coach
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user || !['COACH', 'TEAM_MANAGER', 'CLUB_TRAINER'].includes(user.userType)) {
      return NextResponse.json({ error: 'Unauthorized - Must be a coach' }, { status: 403 });
    }

    const body = await request.json();
    const { athleteEmail, notes } = body;

    if (!athleteEmail) {
      return NextResponse.json({ error: 'Athlete email is required' }, { status: 400 });
    }

    // Find athlete by email
    const athlete = await prisma.user.findUnique({
      where: { email: athleteEmail },
    });

    if (!athlete) {
      return NextResponse.json({ error: 'Athlete not found' }, { status: 404 });
    }

    if (athlete.userType !== 'ATHLETE') {
      return NextResponse.json({ error: 'User is not an athlete' }, { status: 400 });
    }

    // Check if relationship already exists
    const existing = await prisma.coachAthlete.findUnique({
      where: {
        coachId_athleteId: {
          coachId: decoded.userId,
          athleteId: athlete.id
        }
      }
    });

    if (existing) {
      return NextResponse.json({ error: 'Athlete already added' }, { status: 400 });
    }

    // Create relationship
    const coachAthlete = await prisma.coachAthlete.create({
      data: {
        coachId: decoded.userId,
        athleteId: athlete.id,
        notes: notes || ''
      },
      include: {
        athlete: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            userType: true
          }
        }
      }
    });

    return NextResponse.json({ coachAthlete });
  } catch (error) {
    console.error('Error adding athlete:', error);
    return NextResponse.json(
      { error: 'Failed to add athlete' },
      { status: 500 }
    );
  }
}

