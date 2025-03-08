// The issue is in the fetchAppointmentDataForLocation function
// Specifically in how the data is processed and stored
// Add debugging logs to help troubleshoot
console.log('Background script loaded and running');

// Store appointment data
let appointmentData = {};

// Initialize with location mappings from storage
chrome.storage.local.get(['locationMappings'], function(result) {
  const storedMappings = result.locationMappings || {
    '94': 'Toronto',
    '92': 'Ottawa'
  };
  
  console.log('Retrieved location mappings:', storedMappings);
  
  // Initialize with stored appointment data if available
  chrome.storage.local.get(['appointmentData'], function(result) {
    if (result.appointmentData) {
      appointmentData = result.appointmentData;
      console.log('Retrieved saved appointment data:', appointmentData);
    }
  });
});

// Function to fetch appointment data for a specific location
function fetchAppointmentDataForLocation(locationId, scheduleId, cookies) {
  // Get location name first to use in notifications
  chrome.storage.local.get(['locationMappings'], function(result) {
    const locationMappings = result.locationMappings || {};
    const locationName = locationMappings[locationId] || `Location ID ${locationId}`;
    
    // Notify popup that we're starting a fetch
    chrome.runtime.sendMessage({
      action: "fetchStarted",
      locationId: locationId,
      locationName: locationName
    });
    
    // Track request in storage
    const requestTimestamp = new Date().toISOString();
    chrome.storage.local.get(['requestLog'], function(result) {
      const requestLog = result.requestLog || [];
      requestLog.unshift({
        timestamp: requestTimestamp,
        location: locationName,
        locationId: locationId,
        status: 'started'
      });
      
      // Limit log to 20 entries
      if (requestLog.length > 20) {
        requestLog.pop();
      }
      
      chrome.storage.local.set({requestLog: requestLog});
    });
  
    // Construct the URL 
    const url = `https://ais.usvisa-info.com/en-ca/niv/schedule/${scheduleId}/appointment/days/${locationId}.json?appointments[expedite]=false`;
    
    console.log(`Attempting to fetch data for location ${locationId} from: ${url}`);
    
    // Create headers with cookies
    const headers = {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'Cookie': cookies,
      'Referer': `https://ais.usvisa-info.com/en-ca/niv/schedule/${scheduleId}/appointment`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    };
    
    console.log('Request headers:', headers);
    
    // Fetch appointment data
    fetch(url, {
      method: 'GET',
      headers: headers,
      credentials: 'include' // Include cookies for authenticated requests
    })
    .then(response => {
      console.log(`Response status for location ${locationId}:`, response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        return response.text().then(text => {
          console.error(`HTTP error response text: ${text}`);
          throw new Error(`HTTP error! Status: ${response.status}, Message: ${text}`);
        });
      }
      
      return response.json();
    })
    .then(data => {
      console.log(`Appointment data received for location ${locationId}:`, data);
      
      // Update request log
      updateRequestLog(locationId, requestTimestamp, 'success');
      
      // Verify data format
      if (!Array.isArray(data)) {
        const errMsg = `Unexpected data format for location ${locationId}, expected array`;
        console.error(errMsg, data);
        chrome.runtime.sendMessage({
          action: "fetchError",
          locationId: locationId,
          locationName: locationName,
          error: errMsg
        });
        return;
      }
      
      // Extract dates from the raw API response
      const availableDates = data.map(item => item.date);
      console.log(`Extracted dates for location ${locationId}:`, availableDates);
      
      // Get location mappings from storage
      chrome.storage.local.get(['locationMappings'], function(result) {
        const locationMappings = result.locationMappings || {};
        
        // Get location name from mapping or use ID if not found
        const locationName = locationMappings[locationId] || `Location ID ${locationId}`;
        
        // THIS IS THE MAIN FIX: First get the current data, then update it
        // Store the appointment data for this location
        chrome.storage.local.get(['appointmentData'], function(result) {
          let currentData = result.appointmentData || {};
          
          // Create a completely new object to ensure reactivity
          const updatedData = {...currentData};
          
          updatedData[locationId] = {
            name: locationName,
            availableDates: availableDates,
            lastUpdated: new Date().toISOString()
          };
          
          // Store the updated appointment data
          chrome.storage.local.set({appointmentData: updatedData}, function() {
            console.log('Appointment data saved to storage:', updatedData);
            
            // Update the global variable with the NEW object
            appointmentData = updatedData;
            
            // Create a proper formatted array for notifications
            const locationsArray = Object.values(updatedData);
            
            // Notify any open tabs to update their appointment tables
            notifyContentScripts({locations: locationsArray});
            
            // Notify popup that fetch completed successfully
            chrome.runtime.sendMessage({
              action: "fetchCompleted",
              locationId: locationId,
              locationName: locationName,
              // Send full data with the completion message
              data: {
                locations: locationsArray
              }
            });
          });
        });
      });
    })
    .catch(error => {
      const errorMessage = `Error fetching appointment data for location ${locationId}: ${error.message}`;
      console.error(errorMessage);
      
      // Update request log
      updateRequestLog(locationId, requestTimestamp, 'error', error.message);
      
      // Display the error in the extension
      chrome.runtime.sendMessage({
        action: "fetchError",
        locationId: locationId,
        locationName: locationName,
        error: error.message
      });
    });
  });
}

// Helper function to update request log consistently
function updateRequestLog(locationId, timestamp, status, errorMessage = null) {
  chrome.storage.local.get(['requestLog'], function(result) {
    const requestLog = result.requestLog || [];
    const requestIndex = requestLog.findIndex(r => 
      r.locationId === locationId && r.timestamp === timestamp);
    
    if (requestIndex !== -1) {
      requestLog[requestIndex].status = status;
      if (errorMessage) {
        requestLog[requestIndex].error = errorMessage;
      }
      chrome.storage.local.set({requestLog: requestLog});
    }
  });
}

// Function to notify content scripts about updated data
function notifyContentScripts(data) {
  chrome.tabs.query({}, function(tabs) {
    console.log('Notifying content scripts with data:', data);
    
    tabs.forEach(tab => {
      if (tab.url && tab.url.includes('usvisa-info.com')) {
        chrome.tabs.sendMessage(tab.id, {
          action: "updateAppointmentTable", 
          data: data
        }).catch(err => console.log(`Could not send message to tab ${tab.id}: ${err.message}`));
      }
    });
  });
}

// Function to get all cookies for a specific domain
function getCookiesForDomain(domain, callback) {
  chrome.cookies.getAll({domain: domain}, function(cookies) {
    if (cookies && cookies.length > 0) {
      // Format cookies as a string
      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      callback(cookieString);
    } else {
      console.error('No cookies found for domain:', domain);
      callback(null);
    }
  });
}

// Extract cookies from an active usvisa-info.com tab
function extractCookiesFromActivePage(callback) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('usvisa-info.com')) {
      console.log('Found active usvisa-info.com tab, attempting to extract cookies');
      
      // Execute script to extract cookies
      chrome.scripting.executeScript({
        target: {tabId: tabs[0].id},
        function: () => {
          return {
            cookies: document.cookie,
            url: window.location.href,
            csrf: document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
          };
        }
      }, (results) => {
        if (results && results[0] && results[0].result) {
          const pageInfo = results[0].result;
          console.log('Successfully extracted cookies from active page:', pageInfo.cookies);
          
          // If we have CSRF token, add it to the cookies
          let cookieString = pageInfo.cookies;
          if (pageInfo.csrf) {
            console.log('Found CSRF token:', pageInfo.csrf);
            cookieString += `; CSRF-TOKEN=${pageInfo.csrf}`;
          }
          
          // Look for schedule ID in the URL if we're on a schedule page
          let scheduleId = null;
          if (pageInfo.url.includes('/schedule/')) {
            const match = pageInfo.url.match(/\/schedule\/(\d+)/);
            if (match && match[1]) {
              scheduleId = match[1];
              console.log(`Found schedule ID in URL: ${scheduleId}`);
              
              // Save the extracted schedule ID
              chrome.storage.local.set({scheduleId: scheduleId});
            }
          }
          
          // Get additional cookies from the Chrome cookie store
          getCookiesForDomain('usvisa-info.com', function(domainCookies) {
            if (domainCookies) {
              // Merge cookies, removing duplicates
              const cookieMap = new Map();
              
              // Add page cookies
              pageInfo.cookies.split('; ').forEach(cookie => {
                const [name, value] = cookie.split('=');
                cookieMap.set(name, value);
              });
              
              // Add domain cookies
              domainCookies.split('; ').forEach(cookie => {
                const [name, value] = cookie.split('=');
                cookieMap.set(name, value);
              });
              
              // Convert back to string
              const mergedCookies = Array.from(cookieMap.entries())
                .map(([name, value]) => `${name}=${value}`)
                .join('; ');
              
              console.log('Merged cookies:', mergedCookies);
              callback(mergedCookies, scheduleId);
            } else {
              // If no additional cookies found, use page cookies
              callback(cookieString, scheduleId);
            }
          });
        } else {
          console.error('Failed to extract cookies from active page');
          callback(null, null);
        }
      });
    } else {
      console.log('No active usvisa-info.com tab found');
      callback(null, null);
    }
  });
}

// Function to check appointments for all configured locations
function checkAllAppointments() {
  console.log('Checking appointments for all locations');
  
  // Get necessary data from storage
  chrome.storage.local.get(['locationMappings', 'scheduleId'], function(result) {
    const locationMappings = result.locationMappings || {};
    const scheduleId = result.scheduleId;
    
    if (!scheduleId) {
      const errorMsg = 'No schedule ID available, need to extract from active tab first';
      console.error(errorMsg);
      chrome.runtime.sendMessage({
        action: "fetchError",
        error: "No schedule ID available. Please visit the visa appointment page first."
      });
      return;
    }
    
    // Extract cookies from active page
    extractCookiesFromActivePage((cookies, detectedScheduleId) => {
      // Use detected schedule ID if available, otherwise use stored one
      const actualScheduleId = detectedScheduleId || scheduleId;
      
      if (!cookies) {
        const errorMsg = 'No cookies available, cannot fetch appointment data';
        console.error(errorMsg);
        chrome.runtime.sendMessage({
          action: "fetchError",
          error: "No authentication cookies available. Please ensure you're logged in to usvisa-info.com."
        });
        return;
      }
      
      if (Object.keys(locationMappings).length === 0) {
        const infoMsg = 'No locations configured. Please add locations in the Settings tab.';
        console.warn(infoMsg);
        chrome.runtime.sendMessage({
          action: "fetchInfo",
          message: infoMsg
        });
      }
      
      // Fetch data for each location
      Object.keys(locationMappings).forEach(locationId => {
        fetchAppointmentDataForLocation(locationId, actualScheduleId, cookies);
      });
    });
  });
}

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log('Message received in background:', request);
    
    if (request.action === "getAppointmentData") {
      // Return the stored appointment data
      chrome.storage.local.get(['appointmentData'], function(result) {
        console.log('Retrieved appointment data from storage:', result.appointmentData);
        
        const locationData = result.appointmentData ? Object.values(result.appointmentData) : [];
        console.log('Formatted location data for response:', locationData);
        
        sendResponse({
          data: {
            locations: locationData
          }
        });
      });
      return true; // Required for async sendResponse
    } 
    else if (request.action === "updateLocationMappings") {
      // Update location mappings
      chrome.storage.local.set({locationMappings: request.data});
      sendResponse({success: true});
      return true;
    } 
    else if (request.action === "checkAppointmentsForLocation") {
      // Get schedule ID and check the specific location
      chrome.storage.local.get(['scheduleId'], function(result) {
        const scheduleId = result.scheduleId;
        
        if (!scheduleId) {
          sendResponse({success: false, error: "No schedule ID available"});
          return;
        }
        
        extractCookiesFromActivePage((cookies, detectedScheduleId) => {
          const actualScheduleId = detectedScheduleId || scheduleId;
          
          if (cookies) {
            fetchAppointmentDataForLocation(request.locationId, actualScheduleId, cookies);
            sendResponse({success: true});
          } else {
            sendResponse({success: false, error: "No cookies available"});
          }
        });
      });
      return true;
    } 
    else if (request.action === "forceDataFetch") {
      checkAllAppointments();
      sendResponse({success: true});
      return true;
    }
    else if (request.action === "extractPageInfo") {
      extractCookiesFromActivePage((cookies, scheduleId) => {
        sendResponse({
          success: !!cookies,
          scheduleId: scheduleId,
          cookiesFound: !!cookies
        });
      });
      return true;
    }
    else if (request.action === "clearAllData") {
      // Clear any existing appointment data
      chrome.storage.local.remove(['appointmentData'], function() {
        console.log('Cleared all appointment data');
        sendResponse({success: true});
      });
      return true;
    }
    else if (request.action === "getRequestLog") {
      // Return the request log
      chrome.storage.local.get(['requestLog'], function(result) {
        sendResponse({
          success: true,
          log: result.requestLog || []
        });
      });
      return true;
    }
  }
);

// Add cookie permission check and request
function checkAndRequestCookiePermission() {
  chrome.permissions.contains({
    permissions: ['cookies'],
    origins: ['*://*.usvisa-info.com/*']
  }, (hasPermission) => {
    if (!hasPermission) {
      console.log('Extension does not have cookie permission, requesting...');
      chrome.permissions.request({
        permissions: ['cookies'],
        origins: ['*://*.usvisa-info.com/*']
      }, (granted) => {
        if (granted) {
          console.log('Cookie permission granted');
          // Store the permission status
          chrome.storage.local.set({cookiePermissionGranted: true});
        } else {
          console.warn('Cookie permission denied, functionality may be limited');
          // Store the permission status
          chrome.storage.local.set({cookiePermissionGranted: false});
          
          // Notify any open popups about the permission denial
          chrome.runtime.sendMessage({
            action: "permissionDenied",
            permission: "cookies",
            message: "Cookie permission denied. The extension requires cookie access to authenticate with the visa website."
          });
        }
      });
    } else {
      console.log('Extension already has cookie permission');
      chrome.storage.local.set({cookiePermissionGranted: true});
    }
  });
}

// Run permission check on initialization
checkAndRequestCookiePermission();