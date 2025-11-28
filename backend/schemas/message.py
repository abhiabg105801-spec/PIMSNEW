from pydantic import BaseModel
from datetime import datetime

class MessageCreate(BaseModel):
    content: str

class MessageOut(BaseModel):
    id: int
    username: str
    content: str
    pinned: bool = False
    pinned_at: datetime | None = None
    created_at: datetime

    model_config = {
        "from_attributes": True
    }
