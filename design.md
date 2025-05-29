Bell on top right of Feed and Profile screen
- bell has number of notifications as a red bubble 
- mock data for now, will connect to backend later
- Clicking bell opens Notifications screen
- Notifications screen shows list of notifications
    - E.g. <Avatar /> Robert sent you a friend request! <Approve Button />
        -

NotificationCount for now driven by friend reqeusts table
- soon, also driven by being added to a shared circle
- notification will require table in DB, to be deleted when user views/exs it

Feed/Profile/Anywhere with Bell -> Gets notification count
Notification Screen -> NotificationDto
- FriendRequest list []
    - UserDto driving notif (e.g. including avatar)
    - Friend request ID
    - Date
- Can later add on other notification types while maintaining backwards compatibility

TODO: Notif count on /feed and /profile, add helper method to FriendshipService
