const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAgentData(email) {
  try {
    console.log(`Fetching complete data for agent with email: ${email}`);

    // Find the user with the given email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        agent: {
          include: {
            // Include all related data for the agent
            properties: {
              include: {
                reviews: true,
                favorites: true,
                contacts: true
              }
            },
            reviews: {
              include: {
                property: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            },
            payments: true,
            subscriptions: true,
            contacts: {
              include: {
                property: true,
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        },
        contacts: true,
        favorites: {
          include: {
            property: true
          }
        },
        reviews: {
          include: {
            property: true,
            agent: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user) {
      console.log('❌ No user found with the given email');
      return;
    }

    console.log('✅ User data retrieved successfully!');
    console.log('=====================================');
    console.log('USER INFORMATION:');
    console.log('=====================================');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`First Name: ${user.firstName}`);
    console.log(`Last Name: ${user.lastName}`);
    console.log(`Role: ${user.role}`);
    console.log(`Avatar: ${user.avatar || 'N/A'}`);
    console.log(`Created At: ${user.createdAt}`);
    console.log(`Updated At: ${user.updatedAt}`);

    if (!user.agent) {
      console.log('\n❌ No agent record exists for this user');
      console.log('The user exists but does not have an agent profile.');

      // Show user-related data even without agent record
      console.log('\n=====================================');
      console.log('USER CONTACTS MADE:');
      console.log('=====================================');
      if (user.contacts.length === 0) {
        console.log('No user contacts found');
      } else {
        user.contacts.forEach((contact, index) => {
          console.log(`\nContact ${index + 1}:`);
          console.log(`  ID: ${contact.id}`);
          console.log(`  Name: ${contact.name}`);
          console.log(`  Email: ${contact.email}`);
          console.log(`  Phone: ${contact.phone || 'N/A'}`);
          console.log(`  Subject: ${contact.subject}`);
          console.log(`  Message: ${contact.message}`);
          console.log(`  Inquiry Type: ${contact.inquiryType}`);
          console.log(`  Status: ${contact.status}`);
          console.log(`  Created At: ${contact.createdAt}`);
        });
      }

      console.log('\n=====================================');
      console.log('USER FAVORITES:');
      console.log('=====================================');
      if (user.favorites.length === 0) {
        console.log('No favorites found');
      } else {
        user.favorites.forEach((favorite, index) => {
          console.log(`\nFavorite ${index + 1}:`);
          console.log(`  ID: ${favorite.id}`);
          console.log(`  Property: ${favorite.property.title}`);
          console.log(`  Property ID: ${favorite.propertyId}`);
          console.log(`  Status: ${favorite.status}`);
          console.log(`  Created At: ${favorite.createdAt}`);
        });
      }

      console.log('\n=====================================');
      console.log('USER REVIEWS GIVEN:');
      console.log('=====================================');
      if (user.reviews.length === 0) {
        console.log('No reviews given');
      } else {
        user.reviews.forEach((review, index) => {
          console.log(`\nReview ${index + 1}:`);
          console.log(`  ID: ${review.id}`);
          console.log(`  Rating: ${review.rating}`);
          console.log(`  Comment: ${review.comment}`);
          console.log(`  Status: ${review.status}`);
          console.log(`  Property: ${review.property.title}`);
          console.log(`  Agent: ${review.agent ? `${review.agent.user.firstName} ${review.agent.user.lastName}` : 'N/A'}`);
          console.log(`  Created At: ${review.createdAt}`);
        });
      }

      return;
    }

    console.log('✅ Agent data retrieved successfully!');
    console.log('=====================================');
    console.log('USER INFORMATION:');
    console.log('=====================================');
    console.log(`ID: ${user.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`First Name: ${user.firstName}`);
    console.log(`Last Name: ${user.lastName}`);
    console.log(`Role: ${user.role}`);
    console.log(`Avatar: ${user.avatar || 'N/A'}`);
    console.log(`Created At: ${user.createdAt}`);
    console.log(`Updated At: ${user.updatedAt}`);

    console.log('\n=====================================');
    console.log('AGENT INFORMATION:');
    console.log('=====================================');
    const agent = user.agent;
    console.log(`Agent ID: ${agent.id}`);
    console.log(`User ID: ${agent.userId}`);
    console.log(`Registration Number: ${agent.registrationNumber}`);
    console.log(`Commission Rate: ${agent.commissionRate}`);
    console.log(`Specialties: ${agent.specialties.join(', ') || 'N/A'}`);
    console.log(`Bio: ${agent.bio || 'N/A'}`);
    console.log(`Phone: ${agent.phone || 'N/A'}`);
    console.log(`Profile Image: ${agent.profileImage || 'N/A'}`);
    console.log(`Business Name: ${agent.businessName || 'N/A'}`);
    console.log(`Is Verified: ${agent.isVerified}`);
    console.log(`Verification Status: ${agent.verificationStatus}`);
    console.log(`Subscription Plan: ${agent.subscriptionPlan}`);
    console.log(`Listing Limits: ${agent.listingLimits}`);
    console.log(`Created At: ${agent.createdAt}`);
    console.log(`Updated At: ${agent.updatedAt}`);

    console.log('\n=====================================');
    console.log('PROPERTIES:');
    console.log('=====================================');
    if (agent.properties.length === 0) {
      console.log('No properties found');
    } else {
      agent.properties.forEach((property, index) => {
        console.log(`\nProperty ${index + 1}:`);
        console.log(`  ID: ${property.id}`);
        console.log(`  Title: ${property.title}`);
        console.log(`  Description: ${property.description}`);
        console.log(`  Price: ${property.price} ${property.currency}`);
        console.log(`  Address: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}`);
        console.log(`  Bedrooms: ${property.bedrooms}, Bathrooms: ${property.bathrooms}, SqFt: ${property.squareFootage}`);
        console.log(`  Property Type: ${property.propertyType}`);
        console.log(`  Status: ${property.status}`);
        console.log(`  Features: ${property.features.join(', ') || 'N/A'}`);
        console.log(`  Images: ${property.images.length} images`);
        console.log(`  Reviews: ${property.reviews.length}`);
        console.log(`  Favorites: ${property.favorites.length}`);
        console.log(`  Contacts: ${property.contacts.length}`);
        console.log(`  Created At: ${property.createdAt}`);
      });
    }

    console.log('\n=====================================');
    console.log('REVIEWS RECEIVED:');
    console.log('=====================================');
    if (agent.reviews.length === 0) {
      console.log('No reviews found');
    } else {
      agent.reviews.forEach((review, index) => {
        console.log(`\nReview ${index + 1}:`);
        console.log(`  ID: ${review.id}`);
        console.log(`  Rating: ${review.rating}`);
        console.log(`  Comment: ${review.comment}`);
        console.log(`  Status: ${review.status}`);
        console.log(`  Likes: ${review.likes || 0}, Dislikes: ${review.dislikes || 0}`);
        console.log(`  Property: ${review.property ? review.property.title : 'N/A'}`);
        console.log(`  Reviewer: ${review.user.firstName} ${review.user.lastName} (${review.user.email})`);
        console.log(`  Created At: ${review.createdAt}`);
      });
    }

    console.log('\n=====================================');
    console.log('PAYMENTS:');
    console.log('=====================================');
    if (agent.payments.length === 0) {
      console.log('No payments found');
    } else {
      agent.payments.forEach((payment, index) => {
        console.log(`\nPayment ${index + 1}:`);
        console.log(`  ID: ${payment.id}`);
        console.log(`  Amount: ${payment.amount} ${payment.currency}`);
        console.log(`  Status: ${payment.status}`);
        console.log(`  Method: ${payment.method}`);
        console.log(`  Transaction ID: ${payment.transactionId || 'N/A'}`);
        console.log(`  Description: ${payment.description || 'N/A'}`);
        console.log(`  Subscription ID: ${payment.subscriptionId || 'N/A'}`);
        console.log(`  Created At: ${payment.createdAt}`);
      });
    }

    console.log('\n=====================================');
    console.log('SUBSCRIPTIONS:');
    console.log('=====================================');
    if (agent.subscriptions.length === 0) {
      console.log('No subscriptions found');
    } else {
      agent.subscriptions.forEach((subscription, index) => {
        console.log(`\nSubscription ${index + 1}:`);
        console.log(`  ID: ${subscription.id}`);
        console.log(`  Plan: ${subscription.plan}`);
        console.log(`  Status: ${subscription.status}`);
        console.log(`  Start Date: ${subscription.startDate}`);
        console.log(`  End Date: ${subscription.endDate}`);
        console.log(`  Auto Renew: ${subscription.autoRenew}`);
        console.log(`  Price: ${subscription.price} ${subscription.currency}`);
        console.log(`  Created At: ${subscription.createdAt}`);
      });
    }

    console.log('\n=====================================');
    console.log('CONTACTS RECEIVED:');
    console.log('=====================================');
    if (agent.contacts.length === 0) {
      console.log('No contacts found');
    } else {
      agent.contacts.forEach((contact, index) => {
        console.log(`\nContact ${index + 1}:`);
        console.log(`  ID: ${contact.id}`);
        console.log(`  Name: ${contact.name}`);
        console.log(`  Email: ${contact.email}`);
        console.log(`  Phone: ${contact.phone || 'N/A'}`);
        console.log(`  Subject: ${contact.subject}`);
        console.log(`  Message: ${contact.message}`);
        console.log(`  Inquiry Type: ${contact.inquiryType}`);
        console.log(`  Status: ${contact.status}`);
        console.log(`  Property: ${contact.property ? contact.property.title : 'N/A'}`);
        console.log(`  User: ${contact.user ? `${contact.user.firstName} ${contact.user.lastName} (${contact.user.email})` : 'N/A'}`);
        console.log(`  Created At: ${contact.createdAt}`);
      });
    }

    console.log('\n=====================================');
    console.log('USER CONTACTS MADE:');
    console.log('=====================================');
    if (user.contacts.length === 0) {
      console.log('No user contacts found');
    } else {
      user.contacts.forEach((contact, index) => {
        console.log(`\nContact ${index + 1}:`);
        console.log(`  ID: ${contact.id}`);
        console.log(`  Name: ${contact.name}`);
        console.log(`  Email: ${contact.email}`);
        console.log(`  Phone: ${contact.phone || 'N/A'}`);
        console.log(`  Subject: ${contact.subject}`);
        console.log(`  Message: ${contact.message}`);
        console.log(`  Inquiry Type: ${contact.inquiryType}`);
        console.log(`  Status: ${contact.status}`);
        console.log(`  Created At: ${contact.createdAt}`);
      });
    }

    console.log('\n=====================================');
    console.log('USER FAVORITES:');
    console.log('=====================================');
    if (user.favorites.length === 0) {
      console.log('No favorites found');
    } else {
      user.favorites.forEach((favorite, index) => {
        console.log(`\nFavorite ${index + 1}:`);
        console.log(`  ID: ${favorite.id}`);
        console.log(`  Property: ${favorite.property.title}`);
        console.log(`  Property ID: ${favorite.propertyId}`);
        console.log(`  Status: ${favorite.status}`);
        console.log(`  Created At: ${favorite.createdAt}`);
      });
    }

    console.log('\n=====================================');
    console.log('USER REVIEWS GIVEN:');
    console.log('=====================================');
    if (user.reviews.length === 0) {
      console.log('No reviews given');
    } else {
      user.reviews.forEach((review, index) => {
        console.log(`\nReview ${index + 1}:`);
        console.log(`  ID: ${review.id}`);
        console.log(`  Rating: ${review.rating}`);
        console.log(`  Comment: ${review.comment}`);
        console.log(`  Status: ${review.status}`);
        console.log(`  Property: ${review.property.title}`);
        console.log(`  Agent: ${review.agent ? `${review.agent.user.firstName} ${review.agent.user.lastName}` : 'N/A'}`);
        console.log(`  Created At: ${review.createdAt}`);
      });
    }

  } catch (error) {
    console.error('❌ Error fetching agent data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to compare agents with and without records
async function compareAgents() {
  try {
    console.log('Comparing agents with and without agent records...\n');

    // Get all users with AGENT role
    const agentUsers = await prisma.user.findMany({
      where: { role: 'AGENT' },
      include: {
        agent: true
      }
    });

    console.log(`Total users with AGENT role: ${agentUsers.length}\n`);

    const withAgentRecord = agentUsers.filter(user => user.agent);
    const withoutAgentRecord = agentUsers.filter(user => !user.agent);

    console.log('=====================================');
    console.log('AGENTS WITH AGENT RECORDS:');
    console.log('=====================================');
    if (withAgentRecord.length === 0) {
      console.log('None found');
    } else {
      withAgentRecord.forEach((user, index) => {
        console.log(`\nAgent ${index + 1}:`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Name: ${user.firstName} ${user.lastName}`);
        console.log(`  Agent ID: ${user.agent.id}`);
        console.log(`  Registration Number: ${user.agent.registrationNumber}`);
        console.log(`  Verification Status: ${user.agent.verificationStatus}`);
        console.log(`  Business Name: ${user.agent.businessName || 'N/A'}`);
        console.log(`  Phone: ${user.agent.phone || 'N/A'}`);
        console.log(`  Created At: ${user.createdAt}`);
      });
    }

    console.log('\n=====================================');
    console.log('AGENTS WITHOUT AGENT RECORDS:');
    console.log('=====================================');
    if (withoutAgentRecord.length === 0) {
      console.log('None found');
    } else {
      withoutAgentRecord.forEach((user, index) => {
        console.log(`\nAgent ${index + 1}:`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Name: ${user.firstName} ${user.lastName}`);
        console.log(`  User ID: ${user.id}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Created At: ${user.createdAt}`);
      });
    }

    console.log('\n=====================================');
    console.log('SUMMARY:');
    console.log('=====================================');
    console.log(`Total AGENT role users: ${agentUsers.length}`);
    console.log(`With agent records: ${withAgentRecord.length}`);
    console.log(`Without agent records: ${withoutAgentRecord.length}`);

    if (withAgentRecord.length > 0 && withoutAgentRecord.length > 0) {
      console.log('\nDIFFERENCES:');
      console.log('- Users WITH agent records have completed their agent profile setup');
      console.log('- Users WITHOUT agent records have AGENT role but incomplete profiles');
      console.log('- Agent records contain: registration number, business info, verification status, etc.');
      console.log('- Users without records can login as agents but lack detailed profile data');
    }

  } catch (error) {
    console.error('❌ Error comparing agents:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check command line arguments
const command = process.argv[2];
const email = process.argv[3] || 'mubby@homesphere.com';

if (command === 'compare') {
  compareAgents();
} else {
  getAgentData(email);
}
