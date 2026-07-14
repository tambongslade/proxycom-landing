export const API_BASE_URL = 'https://api.proxycom.net/api/v1'; // Production API

interface ApiClientOptions extends RequestInit {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any; // For POST, PUT, PATCH requests
  isFormData?: boolean; // To handle multipart/form-data
}

export const apiClient = async <T>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> => {
  const { data, headers: customHeaders, isFormData, ...restOptions } = options;

  const token = localStorage.getItem('authToken'); // Or get it from your auth context/store

  // Use Headers constructor for easier manipulation
  const headers = new Headers();
  if (!isFormData) {
    headers.set('Content-Type', 'application/json');
  }
  // Add any custom headers passed in options
  if (customHeaders) {
    Object.entries(customHeaders).forEach(([key, value]) => {
      headers.set(key, value as string); // Assuming custom header values are strings
    });
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`); // Use .set() method
  }

  // ADD THIS LOG:
  console.log(`[apiClient] Request to ${endpoint}: Auth Header:`, headers.get('Authorization'), 'Token from localStorage:', token);

  const config: RequestInit = {
    method: options.method || (data ? 'POST' : 'GET'), // Default to POST if data is provided, else GET
    headers,
    ...restOptions,
  };

  if (data) {
    if (isFormData) {
      config.body = data as FormData; // data is already FormData
    } else {
      config.body = JSON.stringify(data);
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    if (response.status === 401) {
      // Unauthorized: token is invalid or missing
      localStorage.removeItem('authToken');
      localStorage.removeItem('authClient'); // Also clear client info
      // Optionally, clear other related local storage items
      // queryClient.clear(); // Cannot directly call useQueryClient here
      window.location.replace('/'); // Force reload to home, AuthContext will re-evaluate
      // Throw an error to stop further processing of this failed request
      throw new Error('Unauthorized - Session terminated'); 
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `API call failed with status ${response.status}`);
    }

    // Handle cases where response might be empty (e.g., 204 No Content)
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return response.json() as Promise<T>;
    } else {
      // For non-JSON responses (like text or empty), resolve with null or response text
      // Adjust as needed based on your API's behavior for non-JSON successful responses
      // For now, we'll assume a successful empty response is acceptable as null
      return null as unknown as T;
    }
  } catch (error) {
    console.error('API Client Error:', error);
    throw error; // Re-throw to be caught by TanStack Query or calling function
  }
};

// Example usage (you'll use this in your TanStack Query hooks):
/*
interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  // ...other user data
}

const loginUser = async (credentials: LoginPayload): Promise<LoginResponse> => {
  return apiClient<LoginResponse>('/auth/client/login', {
    method: 'POST',
    data: credentials,
  });
};
*/ 