// Shared "Quick Links" info modal (index, posts, saved, search pages
const QUICK_LINKS_CONTENT = {
  helpCenter: `
    <h6>Frequently Asked Questions</h6>
    <p><strong>How do I create a post?</strong><br>
    To share your thoughts, click on the "What's on your mind?" field, add your text or media, and then select <em>Post</em>. Your content will appear in the community feed.</p>
    <p><strong>Can I post anonymously?</strong><br>
    Yes. Before submitting, enable the <em>Anonymous</em> option. This ensures your identity is hidden from other users, though Spindle may still retain internal records for security purposes.</p>
    <p><strong>How do I join study groups?</strong><br>
    Navigate to the <em>Study Groups</em> section from the main menu. Browse available groups and click <em>Join</em> to become a member. Some groups may require approval from moderators.</p>
    <p><strong>How do I save or bookmark posts?</strong><br>
    Click the bookmark icon beneath any post to save it. You can access your saved posts later from your profile under the <em>Saved</em> tab.</p>
    <p><strong>How do I manage my account settings?</strong><br>
    Go to your profile and select <em>Settings</em>. From there, you can update your email, change your password, adjust privacy preferences, and manage notifications.</p>
    <p><strong>What happens to deleted posts?</strong><br>
    When you delete a post, it is removed from public view immediately. However, copies may remain in backup storage for a limited time as part of our security and compliance processes.</p>
    <p><strong>How do I report inappropriate content?</strong><br>
    Click the three-dot menu on the post or comment and select <em>Report</em>. Our moderation team will review the report and take appropriate action.</p>
    <p><strong>Can I deactivate or delete my account?</strong><br>
    Yes. Visit <em>Settings</em> → <em>Account</em> → <em>Deactivate/Delete</em>. Deactivation allows you to return later, while deletion permanently removes your account and associated data (subject to legal retention requirements).</p>

    <hr>
    <h6>Getting Started</h6>
    <p>
    New to Spindle? Begin by creating your account, customizing your profile, and exploring communities that match your interests. Visit the <em>Quick Start Guide</em> for step-by-step instructions.
    </p>
    <h6>Community Guidelines</h6>
    <p>
    To keep Spindle safe and welcoming, please follow our <em>Community Rules</em>. Respect others, avoid harmful content, and report inappropriate behavior. Violations may result in warnings or account suspension.
    </p>
    <h6>Account & Privacy</h6>
    <p>
    You can manage your account settings under <em>Profile → Settings</em>. Options include updating your email, changing your password, adjusting privacy preferences, and controlling notifications. For details on how we protect your data, see our Privacy Policy.
    </p>
    <h6>Moderation & Reporting</h6>
    <p>
    Our moderation team works to ensure a safe environment. If you encounter harmful or inappropriate content, use the <em>Report</em> option. Reports are reviewed promptly, and appropriate action will be taken.
    </p>
    <h6>Technical Support</h6>
    <p>
    If you experience technical issues such as login errors, app crashes, or missing features, check the <em>Troubleshooting Guide</em>. If the issue persists, contact our support team.
    </p>
    <hr>
    <p class="text-muted mb-0">
    Need further assistance? Contact the Spindle Support Team at <a href="mailto:support@spindleapp.com">support@spindleapp.com</a>.
    </p>
  `,

  privacy: `
    <p>
      Spindle values your trust and is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our services.
    </p>
    <h5>Information We Collect</h5>
    <ul>
      <li><strong>Account Information:</strong> We collect only the information necessary to create and maintain your account, such as your username, email address, and password.</li>
      <li><strong>Content:</strong> Posts, comments, and files you upload are stored securely and used solely within the platform.</li>
      <li><strong>Usage Data:</strong> We may collect information about how you interact with Spindle, including log data, device information, and preferences, to improve user experience.</li>
    </ul>
    <h5>How We Use Your Information</h5>
    <ul>
      <li>To provide, maintain, and improve our services.</li>
      <li>To protect the security and integrity of the platform.</li>
      <li>To personalize your experience and deliver relevant content.</li>
      <li>To comply with legal obligations and enforce our policies.</li>
    </ul>
    <h5>Data Protection</h5>
    <ul>
      <li><strong>Password Security:</strong> All passwords are encrypted using industry-standard methods.</li>
      <li><strong>Anonymous Posting:</strong> When you choose to post anonymously, your identity is hidden from other users.</li>
      <li><strong>File Usage:</strong> Uploaded files are used exclusively within the platform and are not shared externally.</li>
    </ul>
    <h5>Data Sharing</h5>
    <ul>
      <li>We do not sell or rent your personal information to third parties.</li>
      <li>We may share limited information with trusted service providers who assist us in operating the platform, subject to strict confidentiality agreements.</li>
      <li>We may disclose information if required by law or to protect the rights, safety, and security of our users and services.</li>
    </ul>
    <h5>Your Rights</h5>
    <ul>
      <li>You have the right to access, update, or delete your account information.</li>
      <li>You may request a copy of the personal data we hold about you.</li>
      <li>You can adjust your privacy settings within the platform at any time.</li>
    </ul>
    <h5>Changes to This Policy</h5>
    <p>
      We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. Updates will be posted here, and the "Last Updated" date will be revised accordingly.
    </p>
    <p class="text-muted mb-0">
      Last updated: May 2026
    </p>
  `,

  guidelines: `
    <p>
      Spindle is committed to maintaining a safe, respectful, and productive environment for all users. By participating in the platform, you agree to follow these guidelines to help us keep Spindle welcoming and useful for everyone.
    </p>

    <h5>Respect and Conduct</h5>
    <ul>
      <li><strong>Be respectful:</strong> Treat fellow students and community members with courtesy and consideration.</li>
      <li><strong>No harassment or hate speech:</strong> Harassment, bullying, discrimination, or hate speech of any kind is strictly prohibited.</li>
      <li><strong>Constructive participation:</strong> Engage in discussions thoughtfully and avoid disruptive behavior.</li>
    </ul>

    <h5>Content Standards</h5>
    <ul>
      <li><strong>No illegal or harmful content:</strong> Do not post content that promotes illegal activity, violence, or harm.</li>
      <li><strong>Stay relevant:</strong> Keep discussions aligned with the category or group you are posting in.</li>
      <li><strong>No spam:</strong> Avoid posting advertisements, repetitive content, or duplicate posts.</li>
      <li><strong>Respect academic integrity:</strong> Do not share or encourage cheating, plagiarism, or violations of school policies.</li>
    </ul>

    <h5>Privacy and Safety</h5>
    <ul>
      <li><strong>Protect personal information:</strong> Do not share sensitive personal details about yourself or others.</li>
      <li><strong>Anonymous posting:</strong> Use the anonymous option responsibly to contribute without revealing your identity.</li>
      <li><strong>Reporting issues:</strong> If you encounter harmful or inappropriate content, use the <em>Report</em> feature to notify moderators.</li>
    </ul>

    <h5>Enforcement</h5>
    <p>
      Violations of these guidelines may result in content removal, warnings, temporary restrictions, or permanent account suspension. Enforcement decisions are made at the discretion of the moderation team to protect the integrity of the community.
    </p>

    <p class="text-muted mb-0">
      Last updated: May 2026
    </p>
  `,
};

function initQuickLinks() {
  const infoModalEl = document.getElementById('infoModal');
  if (!infoModalEl) return;

  const helpCenterLink = document.getElementById('helpCenterLink');
  const privacyLink = document.getElementById('privacyLink');
  const guidelinesLink = document.getElementById('guidelinesLink');
  const modalTitle = document.getElementById('infoModalTitle');
  const modalBody = document.getElementById('infoModalBody');
  const infoModal = bootstrap.Modal.getOrCreateInstance(infoModalEl);

  function openInfoModal(title, content) {
    modalTitle.textContent = title;
    modalBody.innerHTML = content;
    infoModal.show();
  }

  helpCenterLink?.addEventListener('click', (e) => {
    e.preventDefault();
    openInfoModal('Help Center', QUICK_LINKS_CONTENT.helpCenter);
  });

  privacyLink?.addEventListener('click', (e) => {
    e.preventDefault();
    openInfoModal('Privacy Policy', QUICK_LINKS_CONTENT.privacy);
  });

  guidelinesLink?.addEventListener('click', (e) => {
    e.preventDefault();
    openInfoModal('Community Guidelines', QUICK_LINKS_CONTENT.guidelines);
  });
}

document.addEventListener('DOMContentLoaded', initQuickLinks);
