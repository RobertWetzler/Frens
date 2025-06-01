Bell on top right of Feed and Profile screen
- bell has number of notifications as a red bubble 
- mock data for now, will connect to backend later
- Clicking bell opens Notifications screen
- Notifications screen shows list of notifications
    - E.g. <Avatar /> Robert sent you a friend request! <Approve Button />
        -
# Notifications
Aim to support web initially with [Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/). See if the .net core lib supports this format.
## Notification Queue
### Adding notification
Any part of the code can call TryAddNotification()
For each Notification added to notification table, add NotificationDelivery entity for every subscription the user has in PushSubscriptions.
### Dequeuing a notification
Set a lock on each NotificationDelivery entity pulled from the table so other instances of the web server wont duplicate sending it. 
## Display in UI
NotificationCount for now driven by friend reqeusts table and notifications table
- notification will require table in DB, to be deleted when user views/exs it

Feed/Profile/Anywhere with Bell -> Gets notification count
Notification Screen -> NotificationDto
- FriendRequest list []
    - UserDto driving notif (e.g. including avatar)
    - Friend request ID
    - Date
- Can later add on other notification types while maintaining backwards compatibility

TODO: Notif count on /feed and /profile, add helper method to FriendshipService
