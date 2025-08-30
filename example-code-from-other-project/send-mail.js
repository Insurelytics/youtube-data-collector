require('dotenv').config();
const FormData = require("form-data"); // form-data v4.0.1
const Mailgun = require("mailgun.js"); // mailgun.js v11.1.0
const fs = require('fs');
const path = require('path');
const { generateProjectsExcel } = require('../../shared/excel-utils');

async function sendEmail(to, subject, text, html = null, attachments = []) {
  const mailgun = new Mailgun(FormData);
  const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY || "API_KEY",
    // When you have an EU-domain, you must specify the endpoint:
    // url: "https://api.eu.mailgun.net"
  });
  try {
    const messageData = {
      from: "Jacob AI <jacob@mail-testing.bschoolland.com>",
      to: [to],
      subject: subject,
      text: text,
    };

    if (html) {
      messageData.html = html;
    }

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      messageData.attachment = attachments;
    }

    const data = await mg.messages.create("mail-testing.bschoolland.com", messageData);
    console.log(`Email sent successfully to ${to}`);
    return data;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
}



function formatProjectSummary(project) {
    const { extractAmount } = require('../utils/dataUtils');
    const estimatedAmt = extractAmount(project['Estimated Amt']) || 0;
    const formattedAmt = estimatedAmt ? `$${estimatedAmt.toLocaleString()}` : 'N/A';
    
    return `• ${project['Project Name'] || 'Unnamed Project'}
  Address: ${project['Address'] || 'N/A'}
  Estimated Amount: ${formattedAmt}
  Received Date: ${project['Received Date'] || 'N/A'}
  Project Type: ${project['Project Type'] || 'N/A'}`;
}

async function sendScheduledLeadsEmail(emailList, totalNewProjects, qualifiedProjects, leadType) {
    const emails = emailList.split(',').map(email => email.trim()).filter(email => email);
    
    if (emails.length === 0) {
        console.log('No email addresses configured, skipping email');
        return;
    }

    const leadTypeName = leadType === 'strongLeads' ? 'Strong Leads' : 
                        leadType === 'weakLeads' ? 'Weak Leads' : 
                        leadType === 'watchlist' ? 'Watchlist' : leadType;
    
    const subject = `New Leads: ${qualifiedProjects.length} Projects Found that Meet your Criteria`;
    
    const textContent = `DSA Scraper Results

Total new projects found: ${totalNewProjects}
New projects that meet your criteria: ${qualifiedProjects.length}

${qualifiedProjects.length > 0 ? `Project Details:
${qualifiedProjects.map(formatProjectSummary).join('\n\n')}` : 'No projects matched your criteria this time.'}

${qualifiedProjects.length > 0 ? 'A detailed Excel file with all qualifying projects is attached.' : ''}

---
This email was sent automatically by the DSA Scraper system.`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
    </style>
</head>
<body>
    <h2>DSA Scraper Results</h2>
    
    <h3>Summary</h3>
    <p><strong>Total new projects found:</strong> ${totalNewProjects}</p>
    <p><strong>New leads that meet your criteria:</strong> ${qualifiedProjects.length}</p>
    
    <hr>
    <p><small>This email was sent automatically by the DSA Scraper system.</small></p>
</body>
</html>`;

    // Create Excel attachment if there are qualified projects
    let attachments = [];
    if (qualifiedProjects.length > 0) {
        const excelBuffer = generateProjectsExcel(qualifiedProjects);
        const filename = `dgs_${leadType}_${new Date().toISOString().split('T')[0]}.xlsx`;
        const tempFilePath = path.join(__dirname, '..', 'temp', filename);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(tempFilePath);
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Write Excel to temp file
        fs.writeFileSync(tempFilePath, excelBuffer);
        
        // For mailgun.js, attachments need to be an array of file streams or buffers
        const fileStream = fs.createReadStream(tempFilePath);
        fileStream.filename = filename; // Set the filename property
        attachments = [fileStream];
    }

    // Send email to each address
    const emailPromises = emails.map(async (email) => {
        try {
            await sendEmail(email, subject, textContent, htmlContent, attachments);
            console.log(`Successfully sent email to ${email}`);
        } catch (error) {
            console.error(`Failed to send email to ${email}:`, error);
        }
    });

    await Promise.all(emailPromises);

    // Clean up temp files
    if (attachments.length > 0) {
        attachments.forEach(attachment => {
            try {
                fs.unlinkSync(attachment.path);
            } catch (error) {
                console.error('Error cleaning up temp file:', error);
            }
        });
    }

    console.log(`Email notifications sent to ${emails.length} recipients`);
}

// Keep old function for backward compatibility but mark as deprecated
async function sendLeadsEmail(to, projectsData) {
    console.warn('sendLeadsEmail is deprecated, use sendScheduledLeadsEmail instead');
    const subject = `Leads Scrape: ${projectsData.length} new leads scraped`;
    const text = `${projectsData.length} new projects found. This is a legacy email format.`;
    await sendEmail(to, subject, text);
}



module.exports = {
    sendLeadsEmail,
    sendScheduledLeadsEmail,
    sendEmail
}