# Interests: Topics That Flow Through Friend Groups

## The Core Idea

I post to #HelloKitty. My friend Bob sees it, thinks "I want to share Hello Kitty stuff too," and starts posting to #HelloKitty. His friends see his posts and can join in. Carol, who's friends with Bob but not me, is now posting to #HelloKitty too. The topic flows organically through the social graph.

No one had to create a circle. No one had to ask permission. No one owns #HelloKitty. We all just use it, and it reaches our own friends who care.

This is the key difference from Circles: Interests are fluid. They spread naturally as friends discover what their friends are posting about, and tag along.

## Why Circles Aren't Enough

Circles require an owner. Someone has to create them, name them, and maintain membership. This creates friction:

1. Ownership burden - the creator feels responsible for the circle's success and ongoing membership management.
2. Fragmentation - if I make a Recipes circle and you make a Cooking circle, we now have two spaces to discuss the same thing.
3. Reach asymmetry - my circle only reaches my friends. If you want to post about recipes too, you either ask me to add your friends (circle bloats with strangers) or make your own (fragmentation).

The result: everyone just uses one big shared circle like "Seattle Shared" and asks me to create topic circles because I'm the "Frens overlord" with the largest reach.

## How Interests Work

Interests have no owner. They're just topics that anyone can post to.

When you post to #Recipes:
- Your friends who follow #Recipes see your posts.
- My friends who follow #Recipes see my posts
- We're both using #Recipes, but reaching our own networks

The fluidity: You see your friend post to #Climbing. You tap the interest to follow it. Now you see all your friends' climbing posts. You start posting to #Climbing too. Your friends discover it through your posts. The topic spreads through the network.

Circles = who (you curate the people)
Interests = what (you pick the topic, people opt themselves in as it flows through the network)

## Key Design Decisions

"Frens-of-frens" opt-in. By default, you only see posts from direct friends. But you can toggle on friend-of-friend visibility per interest, or per post when sharing. Intimacy by default, expansion when desired.

Interests combined with Circles. You can post to #Climbing AND your Seattle circle. Audiences are unioned.

New interest announcement. When posting to an interest that none of your friends follow yet, you can optionally notify all friends: "Robert started posting to #HelloKitty - Add this interest?" This solves the cold start for new topics.

## What This Doesn't Replace

Seattle Shared and other big shared circles still have value. They're geographic communities, town squares. Interests are thematic - #Recipes, #Climbing, #Engineering.

Circles are still useful for curated groups - your college friends, your climbing crew, your work circle. Interests just add another dimension.

## Remaining Questions

Avoid interest naming conflicts: normalize to lowercase, no spaces. #HelloKitty not #Hello Kitty. Show suggestions when typing based on what friends already use.

Interest discovery: surface through posts in feed, through a "popular among your friends" browse page, and on friend profiles.

Rate limiting announcements: maybe one "announce new interest" per week to prevent spam.

## The One-Liner

Post to an interest and the right friends see it. Topics flow through social networks. No more asking Robert to make circles. 