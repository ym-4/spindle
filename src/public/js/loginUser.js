document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  const warningCard = document.getElementById("warningCard");
  const warningText = document.getElementById("warningText");

  const callback = (responseStatus, responseData) => {
    console.log("responseStatus:", responseStatus);
    console.log("responseData:", responseData);

    if (responseStatus == 200) {
      if (responseData.token) {
        localStorage.setItem("token", responseData.token);
        localStorage.setItem(
          "loggedInUserId",
          responseData.userId
        );
        window.location.href = "profile.html";
      }
    } else {
      warningCard.classList.remove("d-none");
      warningText.innerText = responseData.message;
    }
  };

  //login form
  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const name = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    const data = {
      name: name,
      password: password,
    };

    // login api
    fetchMethod(currentUrl + "/persons/login", callback, "POST", data);

    loginForm.reset();
  });
});