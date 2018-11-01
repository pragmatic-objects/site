---
layout: post
title: DI containers are useless and harmful
description: Adequate software design doesn't need any DI containers 
date: 2018-09-19T00:00:00+03:00
---

Once ago in this [post](https://www.yegor256.com/2014/10/03/di-containers-are-evil.html), Yegor Bugayenko named DI 
containers "code polluters". It was quite argueable and contradictory claim. The first time I read it, I left 
unconvinced by provided argumentation. However, later I came to the same conclusion. If you want your application 
design to be maintainable, DI containers is the least thing which will help you with that. In best case, it will be 
just useless. In worst case, as we will see, it will even harm your design. In this post, I will provide my set of 
arguments.

## Disclaimer

I will take Spring Framework as an example, since it is the most known and popular DI framework in Java ecosystem. 
Yes, I know that Spring Framework nowadays is much more than just a DI container---it is more like an integration 
platform. But in this post, I will speak about its DI capabilities only.

Since even as DI container Spring provides lots of capabilities for making injections in different ways, I can't 
cover all of them in one post---it will be too huge. For illustrating my argumentation, I took two most known ways: 
annotation-based injections and Spring XML. Other capabilities of Spring and other DI containers can be mapped on 
the provided argumentation quite easily. If I forgot something, don't hesitate to remind me in comments.

## Lets start

First, all DI capabilities of containers can be divided into two groups:

- Internal configuration: when DI container infers information about bean's dependencies from the bean itself, based on 
annotations, types, names and other metainformation stored inside bean. Examples are injections using `@Autowired` 
and `@Inject` annotations.

- External configuration: when information of the bean's dependencies is defined in external configuration file or 
described in some sort of DSL, provided by container. Examples are Spring XML and Spring Java-based configuration. 

## Thesis 1: Internal configuration is harmful

So, imagine you have some annotated bean:

```java

class BeanA {
    @Autowired BeanB bean;
    
    /// Methods go here
}
```

First question which is raised here: if we have several subtypes of type `BeanB`, instance of which will be injected?

```java
abstract class BeanB {}

class BeanB1 extends BeanB {}

class BeanB2 extends BeanB {}

class BeanA {
    @Autowired BeanB bean; // BeanB1 or BeanB2? 
    
    /// Methods go here
}
```

Lets [search](https://www.baeldung.com/spring-autowire) for the answer:

> By default, Spring resolves `@Autowired` entries by type.
If more than one beans of the same type are available in the container, the framework will throw a fatal exception 
indicating that more than one bean is available for autowiring.

Nice. So---how should we solve it? Same source provides us with several ideas:

- We can annotate autowired injection with `@Qualifier`, saying which bean to inject there
- Spring can use the injected field name as default qualifier

There are of course many other ways Spring provides to work this problem around, but let's stop on qualifiers. How 
we'll fix our injection?

```java
abstract class BeanB {}

@Component("theBean")
class BeanB1 extends BeanB {}

class BeanB2 extends BeanB {}

class BeanA {
    @Autowired @Qualifier("theBean") BeanB bean; // BeanB1! 
    
    /// Methods go here
}
```

Now, let's look at the code from design point of view. Lets assume that types `BeanB1` and `BeanB2` were not 
only [extending](https://www.yegor256.com/2016/09/13/inheritance-is-procedural.html) `BeanB`, but are 
designed to be the [subtypes](https://en.wikipedia.org/wiki/Liskov_substitution_principle) of it. From Liskov 
Substitution principle definition, it'd mean that `BeanA` instances are equally correct with injected `BeanB1` or 
`BeanB2`.

Yet we hardcoded `BeanB1` to `BeanA`. Not directly---through qualifier, but still! What if in one 
place of program we'll need `BeanA` composed with `BeanB1` and in another place---`BeanA` composed with `BeanB2`?

The fact that the dependency-related information is stored inside the bean is actually a huge problem. It is straight
violation of [Dependency Inversion principle](https://en.wikipedia.org/wiki/Dependency_inversion_principle)---instead
of depending on abstraction `BeanB`, concrete `BeanA` depends on another concretion `BeanB1` now.

Containers, operating with configuration placed inside the bean, only pretend to keep the components loosely coupled. 
With such crucial lie called a virtue, it is just impossible to make proper flexible and extendable design. 
There is no more reason to use subtyping with DI containers---one won't be able to reuse the 
components with different subtypes anyway. There is no more reason to outline abstractions like `BeanB` in example, 
for the same reason---one can just omit `BeanB` and hardcode `BeanB1` inside `BeanA` without any qualifiers. Without 
abstractions there is no possibility to follow 
[Open-closed principle](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle) and extend the 
application by writing new modules instead of changing existing ones---one won't be able to substitute them without 
changing dozens of injection points.

Whole solution, built on `@Autowired` dependencies, is nothing more than just a parody on procedural programming. 
Beans there are just tightly-coupled ever-growing ever-changing storages for procedures, with injections as an ugly 
alternative for C-like `#include` directive.

## Thesis 2: External configuration is useless

So, placing configuration inside beans is evil? Okay, but we have also the alternative---we can use Spring XML and 
keep our beans clean:

```java
abstract class BeanB {}

class BeanB1 extends BeanB {}

class BeanB2 extends BeanB {}

class BeanA {
    private final BeanB bean;
    
    public BeanA(BeanB dependency) {
        this.bean = dependency;
    }
    
    /// Methods go here
}
```

```xml
<beans>
<bean id="beanB1" class="BeanB1"/>
<bean id="beanB2" class="BeanB2"/>
<bean id="beanA1" class="BeanA">
    <constructor-arg ref="beanB1"/>
</bean>
<bean id="beanA2" class="BeanA">
    <constructor-arg ref="beanB2"/>
</bean>
</beans>
```

Our beans are clean from dependency-related information now. Container needs no more reasoning about which dependency
to inject based on what is inside in `BeanA`---all the information is now defined in cosy external XML configuration.

Yet this XML-based configuration is not very popular nowadays. People in majority prefer more compact 
and nasty annotation-based way we discussed already. And it's hard to blame them---these XML descriptors can grow 
very huge in very short time, they can be very verbose and hard to understand.

My question is---if it is so hard to keep and maintain these huge XML descriptors, why we really need them? All they 
do is nothing but defining the objects to instantiate---how they are better then just plain Java code?

```java
BeanA beanA1 = new BeanA(
    new BeanB1()
);
BeanA beanA2 = new BeanA(
    new BeanB2()
);
```
   
Collecting a single application from reusable objects is just a question of ordinary object composition---why we need a 
separate complex component like DI container with Spring XML or Spring Java-based configuration for such simple 
and straight-forward matter? Why forcing developers to study unintuitive and ambiguous rules DI containers are 
working by, when they can achieve the same by plain Java and object composition, and it will be much easier to read, 
understand, debug and test? I can't get that, honestly.

## Okay, what are the alternatives?

Alternatives to what? DI containers? Well, nothing. No DI containers. Just healthy object-oriented 
SOLID design would be okay. I said "object-oriented"? Well, funny thing is that functional paradigm never suffered from 
such "DI container" misconcept. Maybe it's time to clean OOP from it either?

Someone may ask here: "Maybe the concept is okay, but that's implementations which are ugly? Maybe we need to make a 
brand new DI container, or use CDI/Dagger/Guice instead?" I tend to disagree with that. The reason is---whatever 
implementation we take or imagine in place of DI container, it will still need to gather information about injections 
from somewhere---either from inside or outside the bean. There is no third way. It will inevitably lead to 
repeating the negative aspects outlined in this post.

So, my motto is: adequate software design doesn't need any DI containers.
