Opt-in Circles
 - Circles that are "publicized" to frens
 - Frens can opt-in to follow them
 - Creation
    - Option in create circle page - allow users to "opt-in" to follow circle
        - Selections
        - Create as "opt-in"
            - Share frens to invite, or invite all (default for v1)
            - Add some as default members
            - Share on profile? (default true)
            - Notify frens (default to true)
                - Appears on homefeed
            - Description (Optional)
- Feed updates
    - Choose circles user is subscribed to.
    - Display circle created, with "Follow" button
    - Display available circles (done)
- View of opt-in circle (wishlist)
    - From owner: number of members in it
    - Description
    - Posts
- Notifications
    - On creation
    - On user join


Data model:
- Update to existing circle
    - isSubscribable: false(?)
- Reuse circlemember join table - any reason not to? Seemingly not. 


Creating Circle
 - If isSubscribable
    - Send notification
    - Add to homefeed? Use notification object?