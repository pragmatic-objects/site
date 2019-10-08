---
layout: post
title: Objects and data
description: What are the differences between object and data, and how to use data in the world of objects
date: 2019-09-18T00:00:00+03:00
---

According to my observations, topics, related to data are one of the most popular and controversial topics in discussions around Elegant Objects.
If [DTO is harmful anti-OOP pattern](https://www.yegor256.com/2016/07/06/data-transfer-object.html), and [ORMs are tools of evil](https://www.yegor256.com/2014/12/01/orm-offensive-anti-pattern.html#whats-wrong-with-orm),
what should we use instead? How are we supposed to work with data in places, where we are working with data by definition? What should we
do on RESTful endpoints level, where we accept and emit data in some format? What should we do on database communication tier, where
we work with data tuples?

At the moment, Elegant Objects proposes two alternatives to DTO: [parsing objects](https://www.yegor256.com/2018/02/27/parsing-objects.html)
and [SQL speaking objects](https://www.yegor256.com/2014/12/01/orm-offensive-anti-pattern.html). They both have one common trait. Instead of structure:

```java
class UserDTO {
      private int id;
      private String name;

      public UserDTO(int id, String name) {
	     this.id = id;
      }

      public int getId() {
      	     return this.id;
      }

      public void setId(int id) {
      	     this.id = id;
      }

      public String getName() {
      	     return this.name;
      }

      public void setName(String name) {
      	     this.name = name;
      }
}
```

...they propose to access data by interface:

```java
interface User {
    int id();
    String name();
}
```

And it really makes sense. Instead piece of soulless data, got god knows from where, 
we have a clear contract, encapsulating details of how the data is obtained,
and protect invariants behind it. However, in my practice, I realized that it is not enough. 
It is still painful to use such data-like interfaces. We miss something.


## What's the problem with data-like interfaces?

Lets take some typical example --- the `Customer`:

```java
interface Customer {
    String name();
    String passportId();
    String address();
    CreditCard creditCard();
}
```

How good is this interface? The answer is the same as for any other abstraction --- it depends on how good it fits the business context.
So lets imagine some. Lets assume that we develop a simple online shop. Consider two use cases:

- A package with ordered items is sent to a customer:

```java
interface Delivery {
    void run();
}

interface DeliveryService {
    void deliver(String address, Package pkg);
}

class FedEx implements DeliveryService {
    // communicates with API of a partner delivery company
}

class DeliveryToCustomer implements Delivery {
    private final Package pkg;
    private final Customer customer;
    private final DeliveryService deliveryService;

    public final void run() {
        // Obtain customer's address and ask your business partner to deliver it
    }
}
```

- Customer is charged for some service

```java
interface Bill {
    void charge();
}

class CustomerBill implements Bill {
    private final Customer customer;
    private final int amount;

    public final void charge() {
        // Obtain the customer's credit card info and charge an amount from it.
    }
}
```

There could be much more of them, and these two are oversimplified, but lets stop on them. It's obvious that customer entity will participate in both scenarious.
But what about *the data* it produces? Do we need customer's passport id to pay some bill? Does a service that delivers the package needs to know the customers name?

No. In first case, a tuple of `{passportId, address}` will be enough. In second case --- `{name, creditCard}` is sufficient.

You may ask here: "What is the problem in providing access to more information then the object needs?". I see one, but crucial:

## Abstractions based on data are usually unstable

`Customer` in our example is an interface. And interfaces are created to be implemented in various ways. `Customer` could have been implemented as
an [SQL speaking object](https://www.yegor256.com/2014/12/01/orm-offensive-anti-pattern.html), or a fake object with static data. It could be read 
from a file, or obtained from a user session, or queried from a neibour microservice. All these implementations are equally valid until they 
respect [Liskov Substitution principle](https://en.wikipedia.org/wiki/Liskov_substitution_principle). The more of potential implementations
you can imagine for your interfaces, the more flexible and easy to extend is your application.

In our example, `Customer` interface is data-like interface. And as a data-like interface, it provides an access to a certain data tuple. But what this tuple refers to?
Does it reflect business? Doubtly, because our business are those two use cases I outlined in the beginning. Business mentions a customer, but doesn't specify (yet) its contents.
And as an interface --- pure abstraction --- `Customer` *must* stand for business.

If not the business, what does it stand for?

In my opinion, there is one mental trap with any data-like structures. No matter how it is done: DTO, data-like interface, case class, or `struct`. Usually it is very tempting to repeat the underlying data model in them. If you have
a table `Customer` in your application's relational database, and it has columns `{id, name, passport, address, creditCard}`, there is big chance that your application will have either DTO, containing all these fields,
or data-like interface with access methods for the same data (and SQL-speaking object implementing it). It is so tempting because it is convenient from data query perspective: it is just easier to select the whole customer in one shot: `SELECT * FROM CUSTOMER`.

Doing one request may be reasonable from data access perspective (provided that you really use all of the fields you got), but tying your interfaces to your data schema is very dangerous. Simply because data model tends to be *volatile*. And if your code abstractions repeat your data model, they will be volatile together. For *interfaces* --- purest of all abstractions --- that is [unacceptable](006_design_core_principles.html#to-sum-up).

While being changed together with your business, `Customer` will inevitablty cause you pain. Because together with the `Customer`, you'll need to update all its implementations. When you remove some fields, or change their type or semantics, it can also impact calling side, which is still bound on it. But it reveals its true ugliness after various updates on `Customer` during pressing milestones, when it can end up being an interface with decades of methods, to which a half of your application is bound to. Just imagine a fake implementation for it... And its instantiation in tests... While the components under test probably use just a couple of its methods... Brrrgh!

## Objects vs data

Curious observation: actually if we look at ways and principles of designing data models and designing software components, we'll find many differences. Actully, more correct would be to say that we won't find anything common.

On one side, there is code. Over the years, code of our solutions grew in complexity, and business requirements, which challenge our code, become more complex, volatile and demanding.
So we invented several tricks of how to handle this complexity. We splat our code to reusable components, [abstracting out the purpose from the details of how this purpose is achieved, and 
separating things which are volatile from things, which are stable](006_design_core_principles.html).

When we design code, we follow certain principles. We call them [SOLID](https://en.wikipedia.org/wiki/SOLID). We care about cohesion and coupling, encapsulation, inheritance, polymorphism. We are concerned about [mutability](objects-should-be-immutable.html), [broken inheritance](inheritance-is-procedural.html), many things...

But all these principles mean nothing when it is about data.

Over the years, amount of data and demands to its consistency, processing and quering speed grew as well. To face this challenge, we invented several data models (relational, graph, NoSQL), 
several data formats (JSON, BSON, XML, YAML, protobuf...), several means for quering and transforming data (SQL, XPath, XSLT...). We invented several types of data structures with
certain access and modification characteristics. We invented different kinds of indexes for improving speed of querying over the large data sets.

What is notable about data is that cohesion, coupling, encapsulation and other things are odd and meaningless here. In the world of data, [ACID](https://en.wikipedia.org/wiki/ACID) are the principles we care about. Not SOLID.

While we encapsulate details in code in order to simplify its reuse, constrain its invariants, data models were never supposed to hide anything. On the contrary, we provided more and more various instruments for obtaining pieces of naked data as fast as it is possible. Restricting access to data or separating it still makes sense in certain cases, like tenancy or clustering. But it *never* makes working with data or maintaining data models simpler. Just like it is never intended to simplify it.

While we abstract out stable code components from volatile implementations, in a typical data model *everything* is potentially volatile. Almost every business requirement impacts data model of your application. There is just nothing to abstract out. In data world, nobody even tries to fight with volatility because it is meaningless. Instead, they use data migration and schema versioning solutions. More sophisticated are these solutions, less concern there is to people who maintain the model.

While we are concerned about mutability in our code, agitate for purity and statelessness of our components, data models are just mutable by definition. To think more of it, mutability is just innatural for computer programs. We can hide all side effects behind immutable objects or monads but we'll never run away from the fact that in the end, our programm will be compiled to a set of imperative machine instructions, operating with data models in mutable RAM, hard disk, stateful IO.

That's why no matter how we bring data model to application: via DTO, or data-like interfaces, it will always cause maintanance pain. Just embrace it. `Customer`, that repeats your data model, causes conflict of these two different worlds: code and data.

## A possible way out of it

Well, the options to fight against it are quite limited actually. If we really need the `Customer` data-like interface, that is bound to a table from some data schema, we just need to keep in mind 
that despite being an interface, is *not* a stable abstraction anymore.

And when some thing is unstable, it is in your interest to limit its reuse to the minimum. One way of doing it is the following:

```java
class DeliveryToCustomer implements Delivery {
    private final Package pkg;
    private final PassportId passportId;
    private final Address address;
    private final DeliveryService deliveryService;

    public final void run() {
        // Ask your business partner to deliver the package to a certain address
    }
}

class CustomerBill implements Bill {
    private final CustomerName name;
    private final CreditCard creditCard;
    private final int amount;

    public final void charge() {
        // Obtain the customer's credit card info and charge an amount from it.
    }
}


interface CustomerName {
    String name();
}

interface Address {
    String address();
}

interface CreditCard {
    String creditCardNumber();
}

interface PassportId {
    String passportId();
}


interface Customer extends CustomerName, Address, CreditCard, PassportId {
}
```

Notice that `CustomerBill` and `DeliveryToCustomer` doesn't bound directly to `Customer`. Minus two reuse places of `Customer`. Since you don't need fake customers to test `CustomerBill` and `DeliveryToCustomer`, you don't need static implementation of `Customer` either. Minus one more. Theoretically, `Customer` could still be implemented as an SQL-speaking object based on `SELECT * FROM CUSTOMER` query. But *the caller side doesn't expect it anymore*. SQL speaking customer becomes optional. The callers are bound only on those pieces of `Customer` that they need. `CustomerBill` doesn't require fully implemented `Customer`, it is okay with a pair of `CustomerName` and `CreditCard` implementations. And while `Customer` implements these pieces, it can be substituted there as well.

If in future business decides to change package delivery procedure and bound it to, I don't know, the customer's phone number, the only thing that will be impacted by this business decision is `DeliveryToCustomer` --- new attribute `PhoneNumber phone` will be introduced there, and handled in `run()` method. From where this phone number would come from? Depends on what business wants, but this is low-level details. Probably we'd update our `CUSTOMER` table, keep customers phones there and provide an access to them via `Customer` interface? Or it can be obtained from a separate phone catalog service via some new implementation of `PhoneNumber`? What important is that no existing abstractions were changed in process.

## Instead of conclusion

At this time the solution may seem like it doesn't worth it. There is plenty of boilerplate there.

Maybe so. But it is the only possible solution to the problem of "code vs data" dualism. It is hard to decouple data-like constructs from underlying data model, but the code *must* be decoupled from it, for the sake of maintainability. And --- one spoiler ahead --- there is actually one solution to this boilerplate problem. But it is another story.


