// Post analytics page
document.addEventListener('DOMContentLoaded', () => {
  if (!isLoggedIn()) {
    redirectToLogin('post-analytics.html' + window.location.search);
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const postId = params.get('id');

  if (postId) {
    loadSinglePostAnalytics(postId);
  } else {
    loadAllPostsAnalytics();
  }
});

// Helpers
function fmtDate(str) {
  if (!str) return '';
  return new Date(str).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function engagementRate(post) {
  const views = post.view_count || 0;
  if (!views) return '—';
  const interactions = (post.like_count || 0) + (post.comment_count || 0) + (post.save_count || 0);
  return ((interactions / views) * 100).toFixed(1) + '%';
}

// Single post analytics
async function loadSinglePostAnalytics(postId) {
  const loading = document.getElementById('analyticsLoading');
  const root = document.getElementById('analyticsRoot');

  try {
    const post = await authFetch(`/posts/${postId}/analytics`);
    const engagementOverTime = await authFetch(`/posts/${postId}/analytics/engagement-over-time`);
    loading.classList.add('d-none');
    root.classList.remove('d-none');
    renderSinglePostAnalytics(post, root, engagementOverTime);
  } catch (e) {
    loading.innerHTML = `
      <i class="fas fa-exclamation-circle text-danger fa-2x mb-2"></i>
      <p class="text-danger">${e.message || 'Could not load analytics.'}</p>`;
  }
}

function renderSinglePostAnalytics(post, root, engagementOverTime = []) {
  document.title = `Analytics: ${post.title} — Spindle`;

  root.innerHTML = `
    <h2 class="analytics-page-title">Post Analytics</h2>
    <div class="analytics-post-title">${escHtml(post.title)}</div>
    <div class="analytics-post-meta">
      <span class="post-category category-${post.category}">${escHtml(post.category)}</span>
    </div>

    <!-- Stat cards -->
    <div class="analytics-stat-grid">
      <div class="analytics-stat-card">
        <i class="fas fa-calendar"></i>
        <div class="analytics-stat-value">${fmtDate(post.created_at)}</div>
        <div class="analytics-stat-label">Published</div>
      </div>
      <div class="analytics-stat-card">
        <i class="fas fa-eye"></i>
        <div class="analytics-stat-value">${post.view_count ?? 0}</div>
        <div class="analytics-stat-label">Views</div>
      </div>
      <div class="analytics-stat-card">
        <i class="fas fa-thumbs-up"></i>
        <div class="analytics-stat-value">${post.like_count ?? 0}</div>
        <div class="analytics-stat-label">Likes</div>
      </div>
      <div class="analytics-stat-card">
        <i class="fas fa-thumbs-down"></i>
        <div class="analytics-stat-value">${post.dislike_count ?? 0}</div>
        <div class="analytics-stat-label">Dislikes</div>
      </div>
      <div class="analytics-stat-card">
        <i class="fas fa-comment"></i>
        <div class="analytics-stat-value">${post.comment_count ?? 0}</div>
        <div class="analytics-stat-label">Comments</div>
      </div>
      <div class="analytics-stat-card">
        <i class="fas fa-bookmark"></i>
        <div class="analytics-stat-value">${post.save_count ?? 0}</div>
        <div class="analytics-stat-label">Saves</div>
      </div>
      <div class="analytics-stat-card">
        <i class="fas fa-percentage"></i>
        <div class="analytics-stat-value">${engagementRate(post)}</div>
        <div class="analytics-stat-label">Engagement rate</div>
      </div>
    </div>

    <!-- Engagement over time -->
    <div class="analytics-chart-card mt-3">
      <h4>Engagement Trend</h4>
      ${
        engagementOverTime.length
          ? '<canvas id="engagementOverTimeChart" height="100"></canvas>'
          : '<p class="text-muted small mb-0">Not enough data yet — likes, dislikes, and saves will appear here over time.</p>'
      }
    </div>

    <!-- Charts -->
    <div class="analytics-charts-grid mt-3">
      <div class="analytics-chart-card">
        <h4>Engagement breakdown</h4>
        <canvas id="reactionsChart" height="220"></canvas>
      </div>
      <div class="analytics-chart-card">
        <h4>Engagement Overview</h4>
        <canvas id="engagementChart" height="220"></canvas>
      </div>
    </div>
  `;

  // Doughnut chart for reactions breakdown
  new Chart(document.getElementById('reactionsChart'), {
    type: 'doughnut',
    data: {
      labels: ['Likes', 'Dislikes'],
      datasets: [
        {
          data: [post.like_count ?? 0, post.dislike_count ?? 0],
          backgroundColor: ['#B7E4C7', '#F7A9A8'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      cutout: '65%',
    },
  });

  // Bar chart for engagement overview
  new Chart(document.getElementById('engagementChart'), {
    type: 'bar',
    data: {
      labels: ['Views', 'Likes', 'Dislikes', 'Comments', 'Saves'],
      datasets: [
        {
          label: 'Count',
          data: [
            post.view_count ?? 0,
            post.like_count ?? 0,
            post.dislike_count ?? 0,
            post.comment_count ?? 0,
            post.save_count ?? 0,
          ],
          backgroundColor: ['#AEC6E4', '#B7E4C7', '#F7A9A8', '#FCE1A8', '#D7C0E4'],
          borderRadius: 6,
          borderWidth: 0,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
      },
    },
  });

  // Engagement over time
  if (engagementOverTime.length) {
    let runningLikes = 0;
    let runningDislikes = 0;
    let runningSaves = 0;
    const labels = engagementOverTime.map((r) =>
      new Date(r.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    );
    const cumulativeLikes = engagementOverTime.map((r) => (runningLikes += r.likes));
    const cumulativeDislikes = engagementOverTime.map((r) => (runningDislikes += r.dislikes));
    const cumulativeSaves = engagementOverTime.map((r) => (runningSaves += r.saves));

    new Chart(document.getElementById('engagementOverTimeChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Likes',
            data: cumulativeLikes,
            borderColor: '#B7E4C7',
            backgroundColor: 'rgba(183, 228, 199, 0.2)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#B7E4C7',
            pointRadius: 3,
          },
          {
            label: 'Dislikes',
            data: cumulativeDislikes,
            borderColor: '#F7A9A8',
            backgroundColor: 'rgba(247, 169, 168, 0.15)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#F7A9A8',
            pointRadius: 3,
          },
          {
            label: 'Saves',
            data: cumulativeSaves,
            borderColor: '#D7C0E4',
            backgroundColor: 'rgba(215, 192, 228, 0.15)',
            fill: true,
            tension: 0.3,
            pointBackgroundColor: '#D7C0E4',
            pointRadius: 3,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
        },
      },
    });
  }
}

// all post analytics
async function loadAllPostsAnalytics() {
  const loading = document.getElementById('analyticsLoading');
  const root = document.getElementById('analyticsRoot');

  try {
    const posts = await authFetch('/posts/analytics/all');
    loading.classList.add('d-none');
    root.classList.remove('d-none');
    renderAllPostsAnalytics(posts, root);
  } catch (e) {
    loading.innerHTML = `
      <i class="fas fa-exclamation-circle text-danger fa-2x mb-2"></i>
      <p class="text-danger">${e.message || 'Could not load analytics.'}</p>`;
  }
}

function renderAllPostsAnalytics(posts, root) {
  document.title = 'My Post Analytics — Spindle';

  if (!posts.length) {
    root.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="fas fa-chart-bar fa-3x mb-3"></i>
        <p>No posts yet to analyse.</p>
      </div>`;
    return;
  }

  const totalViews = posts.reduce((s, p) => s + (p.view_count ?? 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.like_count ?? 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comment_count ?? 0), 0);
  const totalSaves = posts.reduce((s, p) => s + (p.save_count ?? 0), 0);

  // Top 5 by views for the bar chart
  const top5 = [...posts].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 5);

  root.innerHTML = `
    <h2 class="analytics-page-title">
      My Post Analytics
    </h2>

    <!-- Overall stats -->
    <div class="analytics-stat-grid">
      <div class="analytics-stat-card">
        <i class="fas fa-file-alt"></i>
        <div class="analytics-stat-value">${posts.length}</div>
        <div class="analytics-stat-label">Total posts</div>
      </div>
      <div class="analytics-stat-card">
        <i class="fas fa-eye"></i>
        <div class="analytics-stat-value">${totalViews}</div>
        <div class="analytics-stat-label">Total views</div>
      </div>
      <div class="analytics-stat-card">
        <i class="fas fa-thumbs-up"></i>
        <div class="analytics-stat-value">${totalLikes}</div>
        <div class="analytics-stat-label">Total likes</div>
      </div>
      <div class="analytics-stat-card">
        <i class="fas fa-comment"></i>
        <div class="analytics-stat-value">${totalComments}</div>
        <div class="analytics-stat-label">Total comments</div>
      </div>
      <div class="analytics-stat-card">
        <i class="fas fa-bookmark"></i>
        <div class="analytics-stat-value">${totalSaves}</div>
        <div class="analytics-stat-label">Total saves</div>
      </div>
    </div>

    <!-- Charts -->
    <div class="analytics-charts-grid">
      <div class="analytics-chart-card">
        <h4>Top 5 posts by views</h4>
        <canvas id="top5Chart" height="240"></canvas>
      </div>
      <div class="analytics-chart-card">
        <h4>Engagement Breakdown</h4>
        <canvas id="engagementPieChart" height="240"></canvas>
      </div>
    </div>

    <!-- Posts table -->
    <div class="analytics-chart-card mt-3">
      <h4>All posts</h4>
      <div class="analytics-table-wrap">
        <table class="analytics-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Category</th>
              <th>Date</th>
              <th><i class="fas fa-eye"></i></th>
              <th><i class="fas fa-thumbs-up"></i></th>
              <th><i class="fas fa-comment"></i></th>
              <th><i class="fas fa-bookmark"></i></th>
              <th>Engagement</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${posts
              .map(
                (p) => `
              <tr>
                <td class="analytics-table-title">${escHtml(p.title || '')}</td>
                <td><span class="post-category category-${p.category}" style="font-size:0.72rem;">${escHtml(p.category)}</span></td>
                <td class="text-muted small">${fmtDate(p.created_at)}</td>
                <td>${p.view_count ?? 0}</td>
                <td>${p.like_count ?? 0}</td>
                <td>${p.comment_count ?? 0}</td>
                <td>${p.save_count ?? 0}</td>
                <td>${engagementRate(p)}</td>
                <td>
                  <a href="postAnalytics.html?id=${p.id}" class="btn btn-sm btn-outline-secondary">
                    <i class="fas fa-chart-bar"></i>
                  </a>
                </td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Top 5 bar chart
  new Chart(document.getElementById('top5Chart'), {
    type: 'bar',
    data: {
      labels: top5.map((p) => (p.title.length > 20 ? p.title.slice(0, 20) + '…' : p.title)),
      datasets: [
        {
          label: 'Views',
          data: top5.map((p) => p.view_count ?? 0),
          backgroundColor: '#AEC6E4',
          borderRadius: 6,
          borderWidth: 0,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } },
    },
  });

  // Engagement donut chart
  new Chart(document.getElementById('engagementPieChart'), {
    type: 'doughnut',
    data: {
      labels: ['Likes', 'Comments', 'Saves'],
      datasets: [
        {
          data: [totalLikes, totalComments, totalSaves],
          backgroundColor: ['#B7E4C7', '#FCE1A8', '#D7C0E4'],
          borderWidth: 0,
        },
      ],
    },
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' } },
      cutout: '60%',
    },
  });
}

function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
