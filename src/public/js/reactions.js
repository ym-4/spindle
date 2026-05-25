// Spindle Reactions
// - Like
// - Dislike
// - Count updates

const REACTION_API = `${currentUrl}/posts`;


// stores current user's reactions
let userReactions = new Map();


// load reactions
async function loadUserReactions() {

  const userId = localStorage.getItem('loggedInUserId');
  const token  = localStorage.getItem('token');

  if (!userId || !token) return;

  return new Promise((resolve) => {

    fetchMethod(
      `${REACTION_API}/reaction/${userId}`,
      (status, data) => {

        if (status === 200 && Array.isArray(data)) {

          userReactions.clear();

          data.forEach(reaction => {

            userReactions.set(
              parseInt(reaction.post_id),
              {
                id: reaction.id,
                reaction_type: reaction.reaction_type
              }
            );

          });

        }

        resolve();

      },
      'GET',
      null,
      token
    );

  });

}


function initReactionButtons(postId, likeBtn, dislikeBtn) {

  const reaction = userReactions.get(parseInt(postId));

  updateReactionUI(
    likeBtn,
    dislikeBtn,
    reaction ? reaction.reaction_type : null
  );

}

function setupReactionEvents(postId, likeBtn, dislikeBtn) {

  if (likeBtn) {

    likeBtn.addEventListener('click', (e) => {

      e.stopPropagation();

      handleReaction(
        postId,
        'like',
        likeBtn,
        dislikeBtn
      );

    });

  }

  if (dislikeBtn) {

    dislikeBtn.addEventListener('click', (e) => {

      e.stopPropagation();

      handleReaction(
        postId,
        'dislike',
        likeBtn,
        dislikeBtn
      );

    });

  }

}


function handleReaction(postId, clickedReaction, likeBtn, dislikeBtn) {

  const token  = localStorage.getItem('token');
  const userId = localStorage.getItem('loggedInUserId');

  if (!token) {
    if (typeof showAuthPopup === 'function') {
      showAuthPopup();
    }
    return;
  }

  const existingReaction = userReactions.get(parseInt(postId));

  // post reaction
  if (!existingReaction) {

    fetchMethod(

      `${REACTION_API}/like`,

      (status, data) => {

        if (status === 201) {

          userReactions.set(
            parseInt(postId),
            {
              id: data.id,
              reaction_type: clickedReaction
            }
          );

          updateReactionUI(
            likeBtn,
            dislikeBtn,
            clickedReaction
          );

          updateReactionCounts(
            likeBtn,
            dislikeBtn,
            null,
            clickedReaction
          );

        }

      },

      'POST',

      {
        post_id: postId,
        user_id: userId,
        reaction_type: clickedReaction
      },

      token

    );

    return;
  }


  // delete reaction
  if (existingReaction.reaction_type === clickedReaction) {

    fetchMethod(

      `${REACTION_API}/reaction/${existingReaction.id}`,

      (status) => {

        if (status === 200) {

          userReactions.delete(parseInt(postId));

          updateReactionUI(
            likeBtn,
            dislikeBtn,
            null
          );

          updateReactionCounts(
            likeBtn,
            dislikeBtn,
            clickedReaction,
            null
          );

        }

      },

      'DELETE',

      {
        user_id: userId
      },

      token

    );

    return;
  }


  // put reaction
  fetchMethod(

    `${REACTION_API}/reaction/${existingReaction.id}`,

    (status, data) => {

      if (status === 200) {

        const oldReaction = existingReaction.reaction_type;

        userReactions.set(
          parseInt(postId),
          {
            id: existingReaction.id,
            reaction_type: clickedReaction
          }
        );

        updateReactionUI(
          likeBtn,
          dislikeBtn,
          clickedReaction
        );

        updateReactionCounts(
          likeBtn,
          dislikeBtn,
          oldReaction,
          clickedReaction
        );

      }

    },

    'PUT',

    {
      user_id: userId,
      reaction_type: clickedReaction
    },

    token

  );

}


// updating button
function updateReactionUI(likeBtn, dislikeBtn, reactionType) {

  setButtonState(likeBtn, false);
  setButtonState(dislikeBtn, false);

  if (reactionType === 'like') {
    setButtonState(likeBtn, true);
  }

  if (reactionType === 'dislike') {
    setButtonState(dislikeBtn, true);
  }

}



// icon display
function setButtonState(button, active) {

  if (!button) return;

  const icon = button.querySelector('i');

  if (!icon) return;

  if (active) {

    icon.classList.remove('far');
    icon.classList.add('fas');

    button.classList.add('active');

  }
  else {

    icon.classList.remove('fas');
    icon.classList.add('far');

    button.classList.remove('active');

  }

}


// update count display
function updateReactionCounts(
  likeBtn,
  dislikeBtn,
  oldReaction,
  newReaction
) {

  const likeCountEl = likeBtn?.querySelector('.like-count');
  const dislikeCountEl = dislikeBtn?.querySelector('.dislike-count');

  let likeCount = parseInt(likeCountEl?.textContent || 0);
  let dislikeCount = parseInt(dislikeCountEl?.textContent || 0);


  // remove old
  if (oldReaction === 'like') likeCount--;
  if (oldReaction === 'dislike') dislikeCount--;


  // add new
  if (newReaction === 'like') likeCount++;
  if (newReaction === 'dislike') dislikeCount++;


  if (likeCount < 0) likeCount = 0;
  if (dislikeCount < 0) dislikeCount = 0;


  if (likeCountEl) {
    likeCountEl.textContent = likeCount;
  }

  if (dislikeCountEl) {
    dislikeCountEl.textContent = dislikeCount;
  }

}