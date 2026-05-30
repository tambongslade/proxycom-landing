## Frontend Integration for Client Campaign Management

This guide explains how to integrate client-specific campaign management features into your frontend application, allowing authenticated clients to view their own campaigns.

**1. Client Login:**

*   **Endpoint:** `POST /api/v1/auth/client/login`
*   **Purpose:** Authenticate a client user.
*   **Request Body (JSON):**
    ```json
    {
      "email": "client_email@example.com",
      "password": "their_password"
    }
    ```
*   **Successful Response (200 OK):** A JSON object containing a JWT (JSON Web Token).
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTIsImVtYWlsIjoiY2xpZW50QGV4YW1wbGUuY29tIiwicm9sZSI6ImNsaWVudCIsImlhdCI6MTY3ODg4NjQwMCwiZXhwIjoxNjc4OTcyODAwfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    }
    ```
*   **Action:** Your frontend should securely store this `token` (e.g., in `localStorage`, `sessionStorage`, or a secure cookie).

**2. Accessing Client-Specific Campaigns:**

*   Once the client is logged in and you have the token, you can make requests to the client-specific campaign endpoints.
*   For every request to these endpoints, you **must** include the JWT in the `Authorization` header using the `Bearer` scheme.
*   **Example Header:**
    ```
    Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (the rest of your token)
    ```

**3. Endpoints to Use:**

*   **`GET /api/v1/my-campaigns`**:
    *   **Purpose:** Fetches a list of all campaigns that belong to the currently authenticated client.
    *   **Request:**
        ```
        GET /api/v1/my-campaigns
        Authorization: Bearer <your_client_jwt_token>
        ```
    *   **Successful Response (200 OK):** An array of campaign objects.
        ```json
        [
          { "id": 1, "name": "Client's Summer Sale Campaign", "client_id": 12, "...otherCampaignFields" },
          { "id": 5, "name": "Client's New Product Launch", "client_id": 12, "...otherCampaignFields" }
        ]
        ```

*   **`GET /api/v1/my-campaigns/:campaignId`**:
    *   **Purpose:** Fetches a single, specific campaign by its ID, but only if it belongs to the authenticated client.
    *   **Request (e.g., to get campaign with ID 5):**
        ```
        GET /api/v1/my-campaigns/5
        Authorization: Bearer <your_client_jwt_token>
        ```
    *   **Successful Response (200 OK):** A single campaign object.
        ```json
        {
          "id": 5,
          "name": "Client's New Product Launch",
          "client_id": 12,
          "... other campaign fields, including associated radio stations, contract file, etc."
        }
        ```

**4. Handling API Responses and Errors:**

*   **Success (200 OK):** You'll get the campaign data as shown above.
*   **Unauthorized (401):**
    *   This can happen if the `Authorization` header is missing, the token is malformed, invalid (e.g., tampered with, signed with the wrong secret), or expired.
    *   Your frontend should handle this by prompting the client to log in again.
*   **Forbidden (403):**
    *   This will occur if a valid token is provided, but it doesn't have the `role: 'client'`. For example, if an admin token is mistakenly used.
    *   It will also occur for `GET /api/v1/my-campaigns/:campaignId` if the requested `campaignId` does not belong to the authenticated client (even if the campaign exists).
    *   Your frontend should inform the user that they don't have permission to access the resource.
*   **Not Found (404):** This could happen if you request a `campaignId` that doesn't exist at all (e.g., `GET /api/v1/my-campaigns/99999` when campaign 99999 doesn't exist).

**5. Example Frontend Snippet (Conceptual JavaScript using `fetch`):**

```javascript
async function loginClient(email, password) {
  const response = await fetch('/api/v1/auth/client/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Login failed');
  }
  const { token } = await response.json();
  localStorage.setItem('clientToken', token); // Store the token
  return token;
}

async function getMyCampaigns() {
  const token = localStorage.getItem('clientToken');
  if (!token) {
    // Or redirect to login, or show a message
    throw new Error('No client token found. Please log in.');
  }

  const response = await fetch('/api/v1/my-campaigns', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    // Handle token expiry or invalid token -> redirect to login
    console.error('Unauthorized. Token might be invalid or expired.');
    localStorage.removeItem('clientToken'); // Clear bad token
    // window.location.href = '/client-login-page'; // Example redirect
    throw new Error('Unauthorized. Please log in again.');
  }
  if (response.status === 403) {
    console.error('Forbidden. You do not have access to this resource.');
    throw new Error('Forbidden. Access denied.');
  }
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to fetch campaigns');
  }
  return response.json();
}

async function getMyCampaignById(campaignId) {
  const token = localStorage.getItem('clientToken');
  if (!token) {
    throw new Error('No client token found. Please log in.');
  }

  const response = await fetch(`/api/v1/my-campaigns/${campaignId}`, {
     method: 'GET',
     headers: { 'Authorization': `Bearer ${token}` }
  });

  if (response.status === 401) {
    console.error('Unauthorized. Token might be invalid or expired.');
    localStorage.removeItem('clientToken');
    // window.location.href = '/client-login-page';
    throw new Error('Unauthorized. Please log in again.');
  }
  if (response.status === 403) {
    console.error('Forbidden. You do not have access to this campaign.');
    throw new Error('Forbidden. Access to this specific campaign denied.');
  }
   if (response.status === 404) {
    console.error('Campaign not found.');
    throw new Error('Campaign not found.');
  }
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to fetch campaign details');
  }
  return response.json();
}

// --- Usage Example ---
// (async () => {
//   try {
//     const token = await loginClient('client@example.com', 'password123');
//     console.log('Logged in, token:', token);

//     const campaigns = await getMyCampaigns();
//     console.log('My Campaigns:', campaigns);

//     if (campaigns && campaigns.length > 0) {
//       const firstCampaign = await getMyCampaignById(campaigns[0].id);
//       console.log('First Campaign Details:', firstCampaign);
//     }
//   } catch (error) {
//     console.error('An error occurred in the example usage:', error.message);
//     // Update UI to show error to the user
//   }
// })();
```

**Important Considerations:**

*   **API Base URL:** Ensure your frontend uses the correct base URL for API calls (e.g., `http://localhost:3000/api/v1` if your backend runs on port 3000). If your frontend is on a different domain/port, configure CORS on your backend.
*   **Token Storage:** Choose a token storage mechanism (`localStorage`, `sessionStorage`, secure HttpOnly cookies) appropriate for your application's security needs.
*   **Error Handling:** Implement robust error handling in your frontend to inform the user about login failures, permission issues, or network problems.
*   **UX:** Provide clear feedback to the user during login, data fetching, and when errors occur. For example, show loading states.
*   **Logout:** Implement a logout function that clears the stored token and redirects the user appropriately. 