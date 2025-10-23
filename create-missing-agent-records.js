const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createMissingAgentRecords() {
  try {
    console.log('Creating agent records for users with AGENT role but no agent profile...\n');

    // Find all users with AGENT role who don't have agent records
    const usersWithoutAgents = await prisma.user.findMany({
      where: {
        role: 'AGENT',
        agent: null // No agent record exists
      }
    });

    if (usersWithoutAgents.length === 0) {
      console.log('✅ All users with AGENT role already have agent records.');
      return;
    }

    console.log(`Found ${usersWithoutAgents.length} users without agent records:`);
    usersWithoutAgents.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} - ${user.firstName} ${user.lastName}`);
    });

    console.log('\nCreating agent records...\n');

    const createdAgents = [];

    for (const user of usersWithoutAgents) {
      // Generate a unique registration number
      const registrationNumber = 'AGT-' + user.id.slice(-6).toUpperCase();

      // Check if registration number already exists (unlikely but safe)
      const existingAgent = await prisma.agent.findUnique({
        where: { registrationNumber }
      });

      if (existingAgent) {
        console.log(`⚠️  Registration number ${registrationNumber} already exists for user ${user.email}, skipping...`);
        continue;
      }

      const agent = await prisma.agent.create({
        data: {
          userId: user.id,
          registrationNumber,
          verificationStatus: 'PENDING',
          commissionRate: 0.03,
          specialties: ['Real Estate'],
          listingLimits: 25,
          subscriptionPlan: 'BASIC',
          isVerified: false
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      createdAgents.push(agent);
      console.log(`✅ Created agent record for ${user.email}:`);
      console.log(`   - Agent ID: ${agent.id}`);
      console.log(`   - Registration Number: ${agent.registrationNumber}`);
      console.log(`   - Verification Status: ${agent.verificationStatus}`);
      console.log('');
    }

    console.log('=====================================');
    console.log('SUMMARY:');
    console.log('=====================================');
    console.log(`Total users processed: ${usersWithoutAgents.length}`);
    console.log(`Agent records created: ${createdAgents.length}`);

    if (createdAgents.length > 0) {
      console.log('\n✅ All missing agent records have been created successfully!');
      console.log('\nThese agents now have:');
      console.log('- Registration numbers');
      console.log('- Default commission rate (3%)');
      console.log('- Basic subscription plan');
      console.log('- Pending verification status');
      console.log('- Default listing limits (25)');
    }

  } catch (error) {
    console.error('❌ Error creating agent records:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createMissingAgentRecords();
