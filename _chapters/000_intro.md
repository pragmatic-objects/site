---
layout: post
title: Introduction
---

In 2014, Yegor Bugayenko started his own blog, dedicated mainly to 
OOP software development and management. In 2016, he published the first
volume of "Elegant Objects". For the sake of maintainability, he criticized
almost everything we knew and used in OOP for years. Mutability, static methods,
logic in constructors, NULLs, mocks, utility classes, runtime exceptions,
DTO, DAO, ORM, DI containers: all this stuff was claimed evil, straight and without the right to appeal.
Such claim could not left people irrelevant, and flame started: "Who the hell is that guy to blame the concepts we 
use for ages?! How dares he?!".

I first learned about Yegor's Elegant Objects when saw his speech dedicated to SQL-speaking
objects on [JPoint 2016](http://2016.jpoint.ru/talks/bugayenko/) conference. First impression was
a heavy dissonance. But I was ready to the new ideas, because at that time I already 
regret at most of the mainstream stuff I saw in the world of OOP languages: ORMs, DI containers,
GoF/EE patterns... I started looking further.

After trying "Elegant Objects" in action, I came to conclusion that most of the thesis it provides 
indeed make code more maintainable. But this paradigm always felt for me like it's missing something. Even without DTOs,
static functions and other evil stuff, the code is still very fragile. It's still easy to turn it into a mess---not 
convincing enough for the paradigm invented for the sake of maintainability. At the same time, heavy critiques of 
existing ecosystem puts "Elegant objects" to outskurts of the industry, accepted only by a small set of admired 
followers.

Which is sad.

This blog is a summary of my personal independent experience of applying "Elegant Objects" principles in action. Every 
month I will take some thesis from Yegor's blog or books and do an independent review of it. Sometimes I will add 
something. Some thesis I will disprove. The mission of this blog is to take the best from "Elegant Objects", adapt it 
to the current reality and find the best balance between two worlds.

I believe that "Elegant Objects" concept, while having it's own pros and cons, if applied correctly, makes code 
ultimately understandable and reusable. It clearly deserves more attention.
