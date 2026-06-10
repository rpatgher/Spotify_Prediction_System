import random


def play_round() -> str:
    secret_number = random.randint(1, 10)
    guess = random.randint(1, 10)
    if guess == secret_number:
        return f"Guess: {guess}, Secret: {secret_number} -> You win!"
    return f"Guess: {guess}, Secret: {secret_number} -> Try again."


if __name__ == "__main__":
    print(play_round())
