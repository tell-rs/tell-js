// Standard event names — typed constants matching the spec appendix A

export const Events = {
  // User Lifecycle
  UserSignedUp: "User Signed Up",
  UserSignedIn: "User Signed In",
  UserSignedOut: "User Signed Out",
  UserInvited: "User Invited",
  UserOnboarded: "User Onboarded",
  AuthenticationFailed: "Authentication Failed",
  PasswordReset: "Password Reset",
  TwoFactorEnabled: "Two Factor Enabled",
  TwoFactorDisabled: "Two Factor Disabled",

  // Revenue & Billing
  OrderCompleted: "Order Completed",
  OrderRefunded: "Order Refunded",
  OrderCanceled: "Order Canceled",
  PaymentFailed: "Payment Failed",
  PaymentMethodAdded: "Payment Method Added",
  PaymentMethodUpdated: "Payment Method Updated",
  PaymentMethodRemoved: "Payment Method Removed",

  // Subscription
  SubscriptionStarted: "Subscription Started",
  SubscriptionRenewed: "Subscription Renewed",
  SubscriptionPaused: "Subscription Paused",
  SubscriptionResumed: "Subscription Resumed",
  SubscriptionChanged: "Subscription Changed",
  SubscriptionCanceled: "Subscription Canceled",

  // Trial
  TrialStarted: "Trial Started",
  TrialEndingSoon: "Trial Ending Soon",
  TrialEnded: "Trial Ended",
  TrialConverted: "Trial Converted",

  // Shopping
  CartViewed: "Cart Viewed",
  CartUpdated: "Cart Updated",
  CartAbandoned: "Cart Abandoned",
  CheckoutStarted: "Checkout Started",
  CheckoutCompleted: "Checkout Completed",

  // Engagement
  PageViewed: "Page Viewed",
  FeatureUsed: "Feature Used",
  SearchPerformed: "Search Performed",
  FileUploaded: "File Uploaded",
  NotificationSent: "Notification Sent",
  NotificationClicked: "Notification Clicked",

  // Communication
  EmailSent: "Email Sent",
  EmailOpened: "Email Opened",
  EmailClicked: "Email Clicked",
  EmailBounced: "Email Bounced",
  EmailUnsubscribed: "Email Unsubscribed",
  SupportTicketCreated: "Support Ticket Created",
  SupportTicketResolved: "Support Ticket Resolved",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
