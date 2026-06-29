
// method (optional, default: "GET"):
// HTTP method: (e.g., "GET", "POST", "PUT", "DELETE", etc.).

// data (optional, default: null):
// data to be sent: request body. (object that will be converted to JSON)

// token (optional, default: null):
// authorization token: included in the request headers.

function fetchMethod(url, callback, method = "GET", data = null, token = null) {
  console.log("fetchMethod: ", url, method, data, token);

  const headers = {};

  if (data) {
    // If data is provided (i.e., not null), it sets the "Content-Type" header to "application/json"
    // This indicates that the request body contains JSON data. 
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    // If a token provided, sets the "Authorization" header to include the token in the request. 
    headers["Authorization"] = "Bearer " + token;
  }

  // stores method and headers in options
  let options = {
    method: method.toUpperCase(),
    headers: headers,
  };

  // If the HTTP method is not "GET" (data is not null) 
  // adds the data to the options object as a stringified JSON object in the body property.
  if (method.toUpperCase() !== "GET" && data !== null) {
    options.body = JSON.stringify(data);
  }

  // fetch function returns a Promise that resolves to the response from the server. 
  fetch(url, options)
    .then((response) => {
      if (response.status == 204) {
        callback(response.status, {});
      } else {
        response.json().then((responseData) => callback(response.status, responseData));
      }
    })
    .catch((error) => console.error(`Error from ${method} ${url}:`, error));
}