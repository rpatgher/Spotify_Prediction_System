import random


def random_greeting() -> str:
    greetings = ["Hello", "Hi", "Hey", "Welcome", "Good to see you"]
    return random.choice(greetings)


if __name__ == "__main__":
    print(random_greeting())
