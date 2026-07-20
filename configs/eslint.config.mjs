import globals from 'globals';
import pluginJs from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  // ── Ignore patterns ────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'coverage-report/**',
      'reports/**',
    ],
  },

  // ── Server-side Node / CommonJS ────────────────────────
  {
    files: ['src/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    files: ['scripts/**/*.js', 'configs/**/*.js'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },

  // ── ESLint recommended rules ───────────────────────────
  pluginJs.configs.recommended,

  // ── Prettier: disable conflicting ESLint rules ─────────
  prettierConfig,

  // ── Prettier as an ESLint rule ─────────────────────────
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'warn',
    },
  },

  // ── Global rule overrides (applied before per-scope blocks) ──
  {
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  // ── Browser frontend scripts (vanilla JS, <script> tags) ──
  {
    files: ['src/public/js/**/*.js', 'src/public/getCurrentURL.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.browser,

        // ── API / auth ──────────────────────────────────
        authFetch: 'readonly',
        fetchMethod: 'readonly',
        currentUrl: 'readonly',
        API_BASE: 'readonly',
        getApiBase: 'readonly',
        getToken: 'readonly',
        setAuth: 'readonly',
        clearAuth: 'readonly',
        getStoredUser: 'readonly',
        isLoggedIn: 'readonly',
        isAdmin: 'readonly',
        getRememberToken: 'readonly',
        setRememberToken: 'readonly',
        redirectToLogin: 'readonly',
        redirectAfterLogin: 'readonly',
        getPostLoginRedirect: 'readonly',
        updateNavForUser: 'readonly',
        handleLogout: 'readonly',
        token: 'readonly',

        // ── Media / WebSocket ───────────────────────────
        mediaUrl: 'readonly',
        getWsUrl: 'readonly',
        connectSocket: 'readonly',
        onWs: 'readonly',
        sendChatMessage: 'readonly',
        sendCallInvite: 'readonly',
        sendCallAccept: 'readonly',
        sendCallDecline: 'readonly',
        sendCallBusy: 'readonly',
        sendCallCancel: 'readonly',
        sendCallSignal: 'readonly',
        endCall: 'readonly',
        isCamOff: 'writable',

        // ── Toast / notifications ────────────────────────
        showToast: 'readonly',
        displayToast: 'readonly',
        refreshNotifBadge: 'readonly',

        // ── Navigation / shell ───────────────────────────
        injectWaNav: 'readonly',
        injectWaHeader: 'readonly',
        injectHeaderActions: 'readonly',
        injectNotificationsOnly: 'readonly',
        initAppShell: 'readonly',
        initFriendsPanel: 'readonly',
        initSettingsPanel: 'readonly',
        initProfileHub: 'readonly',
        initPersonalChat: 'readonly',
        openMessagesForPeer: 'readonly',
        openAuthModal: 'readonly',
        showAuthPopup: 'readonly',

        // ── Reactions / posts ────────────────────────────
        loadUserReactions: 'readonly',
        initReactionButtons: 'readonly',
        setupReactionEvents: 'readonly',
        renderSpindleSidebar: 'readonly',
        loadYourGroups: 'readonly',
        validatePostForm: 'readonly',
        groupId: 'readonly',

        // ── Marketplace ─────────────────────────────────
        addToCart: 'readonly',
        removeFromCart: 'readonly',
        editCart: 'readonly',
        clearCart: 'readonly',

        // ── Groups ──────────────────────────────────────
        checkGroupAdmin: 'readonly',
        checkGroupCreator: 'readonly',
        channelName: 'readonly',
        fetchGroup: 'readonly',
        fetchGroups: 'readonly',
        createGroup: 'readonly',
        updateGroup: 'readonly',
        deleteGroup: 'readonly',
        acceptJoinRequest: 'readonly',
        declineJoinRequest: 'readonly',
        deleteJoinRequest: 'readonly',
        updateRoleToAdmin: 'readonly',
        updateRoleToUser: 'readonly',
        fetchAllUsers: 'readonly',
        fetchGroupMembers: 'readonly',
        fetchGroupAnnouncements: 'readonly',
        fetchGroupChannels: 'readonly',
        fetchGroupByGroupId: 'readonly',
        fetchGroupJoinRequests: 'readonly',
        fetchGroupDiscussionByChannel: 'readonly',
        createGroupAnnouncement: 'readonly',
        createGroupDiscussionChannel: 'readonly',
        createGroupDiscussionMessage: 'readonly',
        updateGroupAnnouncement: 'readonly',
        updateGroupDiscussionMessage: 'readonly',
        updateGroupPublicity: 'readonly',
        updateGroupModule: 'readonly',
        updateGroupDescription: 'readonly',
        deleteGroupAnnouncement: 'readonly',
        deleteGroupDiscussionChannel: 'readonly',
        deleteGroupDiscussionMessage: 'readonly',
        deleteGroupMember: 'readonly',
        deleteGroupMembership: 'readonly',

        // ── Third-party ─────────────────────────────────
        bootstrap: 'readonly',
        Quill: 'readonly',
        DOMPurify: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { vars: 'local', args: 'none' }],
      'no-redeclare': 'off',
    },
  },

  // ── Test file overrides (Jest + CommonJS) ──────────────
  {
    files: ['__tests__/**/*.js', 'e2e-tests/**/*.js', 'tests-examples/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node, ...globals.jest },
    },
  },

  // ── Server-side unused-vars overrides ──────────────────
  // Excludes src/public/js/ which has its own relaxed config
  {
    files: ['src/**/*.js', 'scripts/**/*.js', 'configs/**/*.js', '__tests__/**/*.js', 'e2e-tests/**/*.js', 'tests-examples/**/*.js'],
    ignores: ['src/public/js/**/*.js', 'src/public/getCurrentURL.js'],
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_|^(next|req|res|e)$', caughtErrors: 'none' }],
    },
  },

  // ── Router overrides (Express handlers) ────────────────
  {
    files: ['src/routers/**/*.js'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^(next|req|res)$' }],
    },
  },
];
