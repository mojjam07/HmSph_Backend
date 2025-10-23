const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createAgentRecord() {
  try {
    // Find the agent user without an agent record
    const agentUser = await prisma.user.findFirst({
      where: { 
        role: 'AGENT',
        agent: null // No agent record exists
      }
    });
    
    if (!agentUser) {
      console.log('No agent user without agent record found');
      return;
    }
    
    console.log('Creating agent record for user:', agentUser.email);
    
    const agent = await prisma.agent.create({
      data: {
        userId: agentUser.id,
        licenseNumber: 'AGT-' + agentUser.id.slice(-6).toUpperCase(),
        verificationStatus: 'PENDING'
      }
    });
    
    console.log('✅ Agent record created successfully!');
    console.log('Agent ID:', agent.id);
    console.log('User ID:', agent.userId);
    console.log('License Number:', agent.licenseNumber);
    console.log('Verification Status:', agent.verificationStatus);
    
  } catch (error) {
    console.error('❌ Error creating agent record:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAgentRecord();
