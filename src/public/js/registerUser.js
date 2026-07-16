document.addEventListener('DOMContentLoaded', function () {
  const signupForm = document.getElementById('signupForm');

  const warningCard = document.getElementById('warningCard');

  const warningText = document.getElementById('warningText');

  //////////////////////////////////////////////////////
  // SIGNUP FORM SUBMIT
  //////////////////////////////////////////////////////
  signupForm.addEventListener('submit', function (event) {
    event.preventDefault();

    const name = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    //password check
    if (password === confirmPassword) {
      console.log('Signup successful');
      console.log('Username:', name);
      console.log('Email:', email);
      console.log('Password:', password);

      warningCard.classList.add('d-none');

      const data = {
        name: name,
        email: email,
        password: password,
      };

      const callback = (responseStatus, responseData) => {
        console.log('responseStatus:', responseStatus);
        console.log('responseData:', responseData);

        if (responseStatus == 200 || responseStatus == 201) {
          // Signup successful
          if (responseData.token) {
            // Save JWT token
            localStorage.setItem('token', responseData.token);
            // Save logged in user id
            localStorage.setItem('loggedInUserId', responseData.userId);
            // Redirect to profile page
            window.location.href = 'profile.html';
          }
        } else {
          // Show error message
          warningCard.classList.remove('d-none');
          warningText.innerText = responseData.message;
        }
      };

      // register api
      fetchMethod(currentUrl + '/persons/register', callback, 'POST', data);
      // Reset form
      signupForm.reset();
    } else {
      // Passwords do not match
      warningCard.classList.remove('d-none');
      warningText.innerText = 'Passwords do not match';
    }
  });
});
