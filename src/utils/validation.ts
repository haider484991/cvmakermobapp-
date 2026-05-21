/**
 * Input Validation Utilities
 *
 * Provides validation functions for common input types
 * to ensure data quality and prevent invalid entries.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates an email address format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || email.trim().length === 0) {
    return { isValid: true }; // Empty is OK (optional field handling done elsewhere)
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return { isValid: false, error: 'Please enter a valid email address' };
  }

  return { isValid: true };
}

/**
 * Validates a phone number
 * Accepts international formats with optional country code
 * Minimum 7 digits (excluding formatting characters)
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || phone.trim().length === 0) {
    return { isValid: true }; // Empty is OK
  }

  // Remove all non-digit characters except + at the start
  const digitsOnly = phone.replace(/[^\d]/g, '');

  // Check for invalid patterns (all same digit, only zeros, etc.)
  if (/^0+$/.test(digitsOnly)) {
    return { isValid: false, error: 'Please enter a valid phone number' };
  }

  // Check if it's just repeated characters
  if (/^(.)\1+$/.test(digitsOnly)) {
    return { isValid: false, error: 'Please enter a valid phone number' };
  }

  // Minimum 7 digits for a valid phone number
  if (digitsOnly.length < 7) {
    return { isValid: false, error: 'Phone number must have at least 7 digits' };
  }

  // Maximum 15 digits (international standard)
  if (digitsOnly.length > 15) {
    return { isValid: false, error: 'Phone number is too long' };
  }

  return { isValid: true };
}

/**
 * Validates a URL format
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || url.trim().length === 0) {
    return { isValid: true }; // Empty is OK
  }

  // Allow URLs without protocol
  let urlToTest = url.trim();
  if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
    urlToTest = 'https://' + urlToTest;
  }

  try {
    new URL(urlToTest);
    return { isValid: true };
  } catch {
    return { isValid: false, error: 'Please enter a valid URL' };
  }
}

/**
 * Validates that a field contains meaningful text
 * Rejects entries that are only special characters, repeated characters, or too short
 */
export function validateText(text: string, options?: {
  minLength?: number;
  maxLength?: number;
  fieldName?: string;
  allowEmpty?: boolean;
}): ValidationResult {
  const { minLength = 2, maxLength = 500, fieldName = 'Field', allowEmpty = true } = options || {};

  if (!text || text.trim().length === 0) {
    if (allowEmpty) {
      return { isValid: true };
    }
    return { isValid: false, error: `${fieldName} is required` };
  }

  const trimmed = text.trim();

  // Check for only special characters or dots
  if (/^[^a-zA-Z0-9]+$/.test(trimmed)) {
    return { isValid: false, error: `${fieldName} must contain letters or numbers` };
  }

  // Check for repeated single character (e.g., "aaaa", "1111")
  if (/^(.)\1+$/.test(trimmed.replace(/\s/g, ''))) {
    return { isValid: false, error: `Please enter a valid ${fieldName.toLowerCase()}` };
  }

  // Check minimum length
  if (trimmed.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` };
  }

  // Check maximum length
  if (trimmed.length > maxLength) {
    return { isValid: false, error: `${fieldName} must be less than ${maxLength} characters` };
  }

  return { isValid: true };
}

/**
 * Validates a name field
 */
export function validateName(name: string): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { isValid: true }; // Empty is OK for optional
  }

  const result = validateText(name, { minLength: 2, fieldName: 'Name' });
  if (!result.isValid) {
    return result;
  }

  // Names should contain at least one letter
  if (!/[a-zA-Z]/.test(name)) {
    return { isValid: false, error: 'Name must contain at least one letter' };
  }

  return { isValid: true };
}

/**
 * Validates a LinkedIn URL
 */
export function validateLinkedIn(url: string): ValidationResult {
  if (!url || url.trim().length === 0) {
    return { isValid: true }; // Empty is OK
  }

  const urlResult = validateUrl(url);
  if (!urlResult.isValid) {
    return urlResult;
  }

  // Check if it's a LinkedIn URL
  const normalizedUrl = url.toLowerCase().trim();
  if (!normalizedUrl.includes('linkedin.com')) {
    return { isValid: false, error: 'Please enter a valid LinkedIn URL' };
  }

  return { isValid: true };
}

/**
 * Validates a GPA value
 */
export function validateGPA(gpa: string): ValidationResult {
  if (!gpa || gpa.trim().length === 0) {
    return { isValid: true }; // Empty is OK
  }

  const gpaNum = parseFloat(gpa);
  if (isNaN(gpaNum)) {
    return { isValid: false, error: 'GPA must be a number' };
  }

  if (gpaNum < 0 || gpaNum > 4.0) {
    return { isValid: false, error: 'GPA must be between 0 and 4.0' };
  }

  return { isValid: true };
}

/**
 * Get validator function by field type
 */
export function getValidator(type: 'email' | 'phone' | 'url' | 'linkedin' | 'name' | 'gpa' | 'text') {
  switch (type) {
    case 'email':
      return validateEmail;
    case 'phone':
      return validatePhone;
    case 'url':
      return validateUrl;
    case 'linkedin':
      return validateLinkedIn;
    case 'name':
      return validateName;
    case 'gpa':
      return validateGPA;
    case 'text':
    default:
      return validateText;
  }
}
